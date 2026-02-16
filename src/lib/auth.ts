import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import "./auth-config"
import { createAuditLog } from "@/lib/audit-log"
import { SignJWT } from "jose"
import { cookies } from "next/headers"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
)

export const { handlers: { GET, POST }, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        login: { label: "Usuário ou Email", type: "text" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        const login = String(credentials?.login || "").trim()
        const password = String(credentials?.password || "")

        if (!login || !password) {
          return null
        }

        const user = await prisma.users.findFirst({
          where: {
            OR: [
              { email: login },
              { name: login },
            ],
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            active: true,
            permissions: true,
            createdById: true,
          }
        })

        if (user) {
          if (!user.active) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(password, user.password)

          console.log("🔐 Tentativa de login:")
          console.log("   Login:", login)
          console.log("   Senha válida:", isPasswordValid)
          console.log("   Hash no banco:", user.password?.substring(0, 20) + "...")

          if (!isPasswordValid) {
            console.log("   ❌ Senha inválida!")
            return null
          }

          console.log("   ✅ Login bem-sucedido via tabela USERS!")
          console.log("   👤 User role:", user.role)

          // Login encontrado na tabela users → retornar baseado no role
          // NÃO verificar se tem convênio vinculado (evita confusão entre users admin/manager e convênios)
          
          // Registrar log de login
          createAuditLog({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: "LOGIN",
            module: "auth",
            description: `Login realizado com sucesso (tabela users)`,
            metadata: {
              email: user.email,
              login,
              role: user.role,
            },
          }).catch(err => console.error("Erro ao criar log de login:", err))

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions || [],
            createdById: user.createdById,
            isConvenio: false,
          }
        }

        // Se não encontrou nas credenciais de usuários, procurar em convênios
        const convenio = await prisma.convenio.findFirst({
          where: {
            ativo: true,
            OR: [
              { usuario: { equals: login, mode: 'insensitive' } },
              { email: { equals: login, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            usuario: true,
            senha: true,
            razao_soc: true,
            fantasia: true,
            email: true,
            userId: true,
            tipo: true,
          },
        })

        if (!convenio || !convenio.senha) {
          return null
        }

        if (convenio.senha !== password) {
          return null
        }

        const convenioEmail = convenio.email?.trim().toLowerCase()
        const convenioUsuario = convenio.usuario?.trim()
        const generatedEmail = (convenioEmail || `${convenioUsuario || `convenio-${convenio.id}`}@convenio.local`).toLowerCase()

        const userOr: Array<{ email?: string | { equals: string; mode: 'insensitive' }; name?: { equals: string; mode: 'insensitive' } }> = [{ email: generatedEmail }]
        if (convenioUsuario) {
          userOr.push({ name: { equals: convenioUsuario, mode: 'insensitive' } })
        }

        let convenioUser = await prisma.users.findFirst({
          where: {
            OR: userOr as any,
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            active: true,
            permissions: true,
            createdById: true,
          },
        })

        if (!convenioUser) {
          const hashedPassword = await bcrypt.hash(password, 10)
          convenioUser = await prisma.users.create({
            data: {
              email: generatedEmail,
              name: convenioUsuario || convenio.fantasia || convenio.razao_soc,
              password: hashedPassword,
              role: "USER",
              active: true,
              permissions: [],
            },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              role: true,
              active: true,
              permissions: true,
              createdById: true,
            },
          })
        }

        if (!convenioUser.active) {
          return null
        }

        if (!convenio.userId || convenio.userId !== convenioUser.id) {
          await prisma.convenio.update({
            where: { id: convenio.id },
            data: { userId: convenioUser.id },
          })
        }

        const token = await new SignJWT({
          convenioId: convenio.id,
          usuario: convenio.usuario || convenioUser.name,
          razaoSocial: convenio.razao_soc,
          fantasia: convenio.fantasia,
          tipo: convenio.tipo || null,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("8h")
          .sign(JWT_SECRET)

        const cookieStore = await cookies()
        cookieStore.set("convenio_session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 8,
          path: "/",
        })

        createAuditLog({
          userId: convenioUser.id,
          userName: convenioUser.name,
          userRole: convenioUser.role,
          action: "LOGIN",
          module: "auth",
          description: `Login realizado com sucesso (convênio)`,
          metadata: {
            email: convenioUser.email,
            login,
            convenioId: convenio.id,
          },
        }).catch(err => console.error("Erro ao criar log de login:", err))

        return {
          id: convenioUser.id,
          email: convenioUser.email,
          name: convenioUser.name,
          role: convenioUser.role,
          permissions: convenioUser.permissions || [],
          createdById: convenioUser.createdById,
          isConvenio: true,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        console.log("📝 Criando JWT token para:", user.email)
        console.log("   Role:", user.role)
        console.log("   Permissions:", (user as any).permissions?.length || 0)
        
        token.role = user.role
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.permissions = (user as any).permissions || []
        token.createdById = (user as any).createdById
        token.isConvenio = (user as any).isConvenio || false
      }
      
      // Suporte para atualização de sessão via update()
      if (trigger === "update" && session?.name) {
        token.name = session.name
      }
      
      return token
    },
    async session({ session, token }) {
      console.log("🔄 Criando sessão para:", token.email)
      
      if (session.user) {
        session.user.role = token.role as string
        session.user.id = token.id as string
        session.user.name = token.name as string
        session.user.createdById = token.createdById as string | null
        session.user.email = token.email as string
        ;(session.user as any).permissions = token.permissions || []
        ;(session.user as any).isConvenio = token.isConvenio || false
        
        console.log("   Role na sessão:", session.user.role)
        console.log("   Permissions na sessão:", (session.user as any).permissions?.length || 0)
      }
      return session
    }
  }
})

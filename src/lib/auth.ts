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

// ─── Rate Limiting (Node.js runtime — persiste entre requests) ───────────────
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutos

interface RateEntry { count: number; firstAttempt: number }
const loginRateLimitMap = new Map<string, RateEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of loginRateLimitMap) {
    if (now - entry.firstAttempt > LOGIN_WINDOW_MS) loginRateLimitMap.delete(key)
  }
}, LOGIN_WINDOW_MS)

function checkLoginRateLimit(key: string): { blocked: boolean; minutosRestantes: number } {
  const now = Date.now()
  const entry = loginRateLimitMap.get(key)

  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginRateLimitMap.set(key, { count: 1, firstAttempt: now })
    return { blocked: false, minutosRestantes: 0 }
  }

  entry.count++
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    const minutosRestantes = Math.ceil((entry.firstAttempt + LOGIN_WINDOW_MS - now) / 60_000)
    return { blocked: true, minutosRestantes }
  }

  return { blocked: false, minutosRestantes: 0 }
}
// ─────────────────────────────────────────────────────────────────────────────

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

        // Rate limiting por login (chave = login em minúsculas)
        const rateLimitKey = login.toLowerCase()
        const { blocked, minutosRestantes } = checkLoginRateLimit(rateLimitKey)
        if (blocked) {
          throw new Error(`Muitas tentativas. Aguarde ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}.`)
        }

        const user = await prisma.users.findFirst({
          where: {
            OR: [
              { email: { equals: login, mode: 'insensitive' } },
              { name: { equals: login, mode: 'insensitive' } },
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
            passwordChangedAt: true,
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
            console.log("   ❌ Senha inválida no users! Verificando fallback convenio...")

            // Fallback: se o user é do tipo USER (auto-criado para convênio),
            // a senha pode ter sido alterada na tabela convenio mas não sincronizada aqui.
            // Verificamos diretamente na tabela convenio.
            if (user.role === 'USER') {
              const convenioFallback = await prisma.convenio.findFirst({
                where: {
                  ativo: true,
                  senha: password,
                  OR: [
                    { userId: user.id },
                    { usuario: { equals: login, mode: 'insensitive' } },
                    { email: { equals: login, mode: 'insensitive' } },
                  ],
                },
                select: { id: true, usuario: true, razao_soc: true, fantasia: true, tipo: true, userId: true, senhaChangedAt: true },
              })

              if (convenioFallback) {
                // Sincroniza o hash desatualizado no users
                const novoHash = await bcrypt.hash(password, 10)
                await prisma.users.update({ where: { id: user.id }, data: { password: novoHash } })
                console.log("   ✅ Senha do convênio válida — hash sincronizado!")
                // Continua com retorno do convenio vinculado
                return {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role,
                  permissions: user.permissions || [],
                  createdById: user.createdById,
                  isConvenio: true,
                  passwordChangedAt: user.passwordChangedAt?.toISOString() || null,
                }
              }
            }

            return null
          }

          console.log("   ✅ Login bem-sucedido via tabela USERS!")
          console.log("   👤 User role:", user.role)

          // Verificar se este user tem convênio vinculado
          // ADMIN e MANAGER NUNCA são tratados como convênio
          // Para USER, verificar se tem convênio vinculado por userId OU por usuario (login)
          let convenioVinculado = null
          if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
            convenioVinculado = await prisma.convenio.findFirst({
              where: {
                ativo: true,
                OR: [
                  { userId: user.id },
                  { usuario: { equals: login, mode: 'insensitive' } },
                  { email: { equals: login, mode: 'insensitive' } },
                ],
              },
              select: {
                id: true,
                usuario: true,
                razao_soc: true,
                fantasia: true,
                tipo: true,
                userId: true,
                senhaChangedAt: true,
              },
            })
          }

          if (convenioVinculado) {
            console.log("   🏢 User auto-criado de convênio:", convenioVinculado.razao_soc)

            // Re-vincular se necessário, mas NUNCA sobrescrever userId de ADMIN/MANAGER
            if (!await prisma.convenio.findFirst({ where: { userId: user.id } })) {
              // Verificar se o userId atual aponta para ADMIN/MANAGER - se sim, não sobrescrever
              let podeAtualizar = true
              if ((convenioVinculado as any).userId) {
                const dono = await prisma.users.findUnique({
                  where: { id: (convenioVinculado as any).userId },
                  select: { role: true },
                })
                if (dono?.role === 'ADMIN' || dono?.role === 'MANAGER') {
                  podeAtualizar = false
                }
              }
              if (podeAtualizar) {
                await prisma.convenio.update({
                  where: { id: convenioVinculado.id },
                  data: { userId: user.id },
                })
              }
            }

            // Setar cookie convenio_session
            const convenioToken = await new SignJWT({
              convenioId: convenioVinculado.id,
              usuario: convenioVinculado.usuario || user.name,
              razaoSocial: convenioVinculado.razao_soc,
              fantasia: convenioVinculado.fantasia,
              tipo: convenioVinculado.tipo || null,
              senhaChangedAt: (convenioVinculado as any).senhaChangedAt?.toISOString() || null,
            })
              .setProtectedHeader({ alg: "HS256" })
              .setIssuedAt()
              .setExpirationTime("8h")
              .sign(JWT_SECRET)

            const cookieStore = await cookies()
            cookieStore.set("convenio_session", convenioToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 60 * 60 * 8,
              path: "/",
            })

            createAuditLog({
              userId: user.id,
              userName: user.name,
              userRole: user.role,
              action: "LOGIN",
              module: "auth",
              description: `Login realizado com sucesso (convênio via user auto-criado)`,
              metadata: {
                email: user.email,
                login,
                convenioId: convenioVinculado.id,
              },
            }).catch(err => console.error("Erro ao criar log de login:", err))

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              permissions: user.permissions || [],
              createdById: user.createdById,
              isConvenio: true,
              passwordChangedAt: user.passwordChangedAt?.toISOString() || null,
            }
          }

          // User real (ADMIN/MANAGER/USER) - NÃO é convênio
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
            passwordChangedAt: user.passwordChangedAt?.toISOString() || null,
          }
        }

        // Usuário não encontrado na tabela users
        // Após rodar scripts/migrate-convenio-to-users.ts, todos os convênios
        // já possuem user vinculado — não é mais necessário lookup direto em convenio.
        return null
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
        token.passwordChangedAt = (user as any).passwordChangedAt || null
      }
      
      // Suporte para atualização de sessão via update()
      if (trigger === "update") {
        if (session?.name) token.name = session.name
        if (session?.passwordChangedAt !== undefined) token.passwordChangedAt = session.passwordChangedAt
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
        ;(session.user as any).passwordChangedAt = token.passwordChangedAt || null
        
        console.log("   Role na sessão:", session.user.role)
        console.log("   Permissions na sessão:", (session.user as any).permissions?.length || 0)
      }
      return session
    }
  }
})

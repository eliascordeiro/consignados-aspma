import NextAuth, { CredentialsSignin } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import "./auth-config"
import { createAuditLog } from "@/lib/audit-log"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { isRateLimited, recordFailedAttempt, clearLoginAttempts } from "@/lib/login-rate-limit"

// Secret exclusivo para tokens one-time do WebAuthn
const WEBAUTHN_OTP_SECRET = new TextEncoder().encode(
  process.env.WEBAUTHN_OTP_SECRET || process.env.NEXTAUTH_SECRET || 'webauthn-fallback-secret-change-me'
)

class RateLimitError extends CredentialsSignin {
  constructor(minutosRestantes: number) {
    super()
    this.code = `rate_limit_${minutosRestantes}`
  }
}

// Sinaliza ao frontend que a senha foi válida mas MFA biométrico é obrigatório
class BiometricRequiredError extends CredentialsSignin {
  constructor() {
    super()
    this.code = 'webauthn_required'
  }
}

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
        password: { label: "Senha", type: "password" },
        faceToken: { label: "Face Token", type: "text" },
      },
      async authorize(credentials) {
        // ── WebAuthn / Biometria ──────────────────────────────────────────
        const faceToken = String(credentials?.faceToken || "").trim()
        if (faceToken) {
          try {
            const { payload } = await jwtVerify(faceToken, WEBAUTHN_OTP_SECRET)
            if (!payload.webauthn || !payload.userId) return null

            const user = await prisma.users.findUnique({
              where: { id: String(payload.userId) },
              select: {
                id: true, email: true, name: true, password: true,
                role: true, active: true, permissions: true,
                createdById: true, passwordChangedAt: true,
              },
            })
            if (!user || !user.active) return null

            createAuditLog({
              userId: user.id,
              userName: user.name,
              userRole: user.role,
              action: 'LOGIN',
              module: 'auth',
              description: 'Login realizado com biometria (WebAuthn)',
              metadata: { email: user.email },
            }).catch(() => {})

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
          } catch {
            return null
          }
        }

        // ── Login tradicional ────────────────────────────────────────────
        const login = String(credentials?.login || "").trim()
        const password = String(credentials?.password || "")

        if (!login || !password) {
          return null
        }

        // Rate limiting: verifica ANTES da senha, registra APENAS se senha errada
        const rateLimitKey = `admin:${login.toLowerCase()}`
        try {
          const { blocked, minutosRestantes } = await isRateLimited(rateLimitKey)
          if (blocked) {
            throw new RateLimitError(minutosRestantes)
          }
        } catch (rlErr) {
          if (rlErr instanceof RateLimitError) throw rlErr
          console.error('[auth] rate limit check failed:', rlErr)
          // Falha aberta: erro técnico no banco não bloqueia o login
        }

        let user = await prisma.users.findFirst({
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

        // Fallback: busca pelo convenio.usuario para suportar login pelo usuário legado
        // Cobre o caso em que users.name foi definido como razao_soc/fantasia (não como usuario)
        if (!user) {
          const convenioByUsuario = await prisma.convenio.findFirst({
            where: {
              ativo: true,
              usuario: { equals: login, mode: 'insensitive' },
              userId: { not: null },
            },
            select: { userId: true },
          })
          if (convenioByUsuario?.userId) {
            user = await prisma.users.findUnique({
              where: { id: convenioByUsuario.userId },
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
              },
            }) ?? null
          }
        }

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
            // Usuários com createdById são criados pelo portal e NÃO são convênio.
            if (user.role === 'USER' && !user.createdById) {
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

            // Senha errada — registrar tentativa falha
            recordFailedAttempt(rateLimitKey).catch(() => {})
            return null
          }

          console.log("   ✅ Login bem-sucedido via tabela USERS!")
          console.log("   👤 User role:", user.role)

          // Limpar contador de tentativas após sucesso
          clearLoginAttempts(rateLimitKey).catch(() => {})

          // ── MFA: se o user tem biometria cadastrada, exige confirmação ──────
          const biometriasCount = await prisma.webAuthnAuthenticator.count({
            where: { userId: user.id },
          })
          if (biometriasCount > 0) {
            if (!faceToken) {
              // Senha válida mas biometria não fornecida — exige o 2º fator
              throw new BiometricRequiredError()
            }
            // Valida que o faceToken foi emitido para ESTE usuário
            // (impede usar o token biométrico de outro user)
            try {
              const { payload } = await jwtVerify(faceToken, WEBAUTHN_OTP_SECRET)
              if (!payload.webauthn || payload.userId !== user.id) {
                console.log('   ❌ faceToken não pertence a este usuário')
                return null
              }
              console.log('   ✅ MFA biométrico confirmado')
            } catch {
              console.log('   ❌ faceToken inválido ou expirado')
              return null
            }
          }
          // ────────────────────────────────────────────────────────────────────

          // Verificar se este user tem convênio vinculado
          // ADMIN e MANAGER NUNCA são tratados como convênio
          // Usuários com createdById foram criados pelo portal e NÃO são convênio
          // Para USER sem createdById, verificar se tem convênio vinculado
          let convenioVinculado = null
          if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && !user.createdById) {
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

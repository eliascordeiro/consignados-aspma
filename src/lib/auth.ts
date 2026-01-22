import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import "./auth-config"

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
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.users.findUnique({
          where: {
            email: credentials.email as string
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            active: true,
            permissions: true,
          }
        })

        if (!user || !user.active) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        console.log("🔐 Tentativa de login:")
        console.log("   Email:", credentials.email)
        console.log("   Senha válida:", isPasswordValid)
        console.log("   Hash no banco:", user.password?.substring(0, 20) + "...")

        if (!isPasswordValid) {
          console.log("   ❌ Senha inválida!")
          return null
        }

        console.log("   ✅ Login bem-sucedido!")

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions || [],
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.permissions = (user as any).permissions || []
      }
      
      // Suporte para atualização de sessão via update()
      if (trigger === "update" && session?.name) {
        token.name = session.name
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
        session.user.id = token.id as string
        session.user.name = token.name as string
        session.user.email = token.email as string
        ;(session.user as any).permissions = token.permissions || []
      }
      return session
    }
  }
})

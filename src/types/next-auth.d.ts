import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      createdById?: string | null
    }
  }

  interface User {
    role: string
    createdById?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    id: string
    createdById?: string | null
  }
}

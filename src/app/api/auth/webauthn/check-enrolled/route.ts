import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/auth/webauthn/check-enrolled?login=xxx
 *
 * Retorna se o login informado possui biometria cadastrada.
 * Usado pelo frontend para detectar o fluxo MFA quando o NextAuth beta.30
 * não propaga o código customizado "webauthn_required" em result.error.
 *
 * Não exige autenticação — sempre retorna { enrolled: boolean }
 * sem revelar se o usuário existe ou não.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const login = searchParams.get("login")?.trim()

  if (!login) {
    return NextResponse.json({ enrolled: false })
  }

  try {
    const user = await prisma.users.findFirst({
      where: {
        active: true,
        OR: [
          { email: { equals: login, mode: "insensitive" } },
          { name:  { equals: login, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    })

    if (!user) return NextResponse.json({ enrolled: false })

    const count = await prisma.webAuthnAuthenticator.count({
      where: { userId: user.id },
    })

    return NextResponse.json({ enrolled: count > 0 })
  } catch {
    return NextResponse.json({ enrolled: false })
  }
}

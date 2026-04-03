// POST /api/auth/webauthn/auth-options
// Gera challenge de autenticação. Aceita username opcional para passkeys não-residentes.
// Rota pública (chamada antes do login).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateAuthenticationOptions } from '@simplewebauthn/server'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const username: string | undefined = body.username?.trim()

  let allowCredentials: { id: string; transports?: any[] }[] = []
  let linkedUserId: string | null = null

  if (username) {
    // Buscar usuário pelo login/email para pré-selecionar as credenciais dele
    const user = await prisma.users.findFirst({
      where: {
        active: true,
        OR: [
          { email: { equals: username, mode: 'insensitive' } },
          { name: { equals: username, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })

    if (user) {
      linkedUserId = user.id
      const authenticators = await prisma.webAuthnAuthenticator.findMany({
        where: { userId: user.id },
        select: { credentialID: true, transports: true },
      })
      allowCredentials = authenticators.map((a) => ({
        id: a.credentialID,
        transports: a.transports as any[],
      }))
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
  })

  // Salvar challenge no banco (sem userId — será resolvido no verify)
  await prisma.webAuthnChallenge.create({
    data: {
      userId: linkedUserId,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return NextResponse.json(options)
}

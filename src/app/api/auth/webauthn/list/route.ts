// GET /api/auth/webauthn/list
// Retorna os autenticadores biométricos do usuário autenticado.
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const authenticators = await prisma.webAuthnAuthenticator.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      credentialID: true,
      credentialDeviceType: true,
      credentialBackedUp: true,
      transports: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ authenticators })
}

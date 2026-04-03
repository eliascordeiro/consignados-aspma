// POST /api/auth/webauthn/register-options
// Gera opções de registro para o autenticador biométrico.
// Requer sessão autenticada (admin/manager/user).
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateRegistrationOptions } from '@simplewebauthn/server'

const RP_NAME = 'A.S.P.M.A Consignados'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const userId = session.user.id
  const userEmail = session.user.email
  const userName = session.user.name

  // Buscar credenciais já registradas para excluir da lista
  const existingAuthenticators = await prisma.webAuthnAuthenticator.findMany({
    where: { userId },
    select: { credentialID: true, transports: true },
  })

  const excludeCredentials = existingAuthenticators.map((a) => ({
    id: a.credentialID,
    transports: a.transports as any[],
  }))

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: userEmail,
    userDisplayName: userName,
    // Prefere passkey residente (permite login sem digitar login)
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform', // biometria do dispositivo (Face ID, Windows Hello)
    },
    excludeCredentials,
  })

  // Salvar challenge no banco (válido por 5 minutos)
  await prisma.webAuthnChallenge.deleteMany({ where: { userId } })
  await prisma.webAuthnChallenge.create({
    data: {
      userId,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return NextResponse.json(options)
}

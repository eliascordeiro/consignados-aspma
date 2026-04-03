// POST /api/auth/webauthn/register-verify
// Verifica e persiste a credencial biométrica registrada.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/browser'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const userId = session.user.id
  const body: RegistrationResponseJSON = await req.json()

  // Recuperar e validar o challenge
  const challengeRecord = await prisma.webAuthnChallenge.findFirst({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!challengeRecord) {
    return NextResponse.json({ error: 'Challenge expirado ou inválido. Tente novamente.' }, { status: 400 })
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Falha na verificação' }, { status: 400 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Registro biométrico não verificado.' }, { status: 400 })
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

  // Limite: máx 5 credenciais por usuário (evita acumulação por cadastros repetidos)
  const existingCount = await prisma.webAuthnAuthenticator.count({ where: { userId } })
  if (existingCount >= 5) {
    await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } })
    return NextResponse.json(
      { error: 'Limite de 5 dispositivos atingido. Remova um antes de adicionar outro.' },
      { status: 400 }
    )
  }

  // Upsert por credentialID: se o mesmo ID já existe (re-registro do mesmo aparelho),
  // apenas atualiza o contador em vez de criar entrada duplicada.
  await prisma.webAuthnAuthenticator.upsert({
    where: { credentialID: credential.id },
    create: {
      userId,
      credentialID: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      credentialDeviceType,
      credentialBackedUp,
      transports: body.response.transports ?? [],
    },
    update: {
      credentialPublicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      credentialDeviceType,
      credentialBackedUp,
      transports: body.response.transports ?? [],
    },
  })

  // Limpar o challenge usado
  await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } })

  return NextResponse.json({ ok: true, message: 'Biometria registrada com sucesso!' })
}

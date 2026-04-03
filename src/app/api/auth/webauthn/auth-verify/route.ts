// POST /api/auth/webauthn/auth-verify
// Verifica a resposta de autenticação biométrica.
// Retorna um token de acesso único (60s) para o NextAuth credentials provider.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser'
import { SignJWT } from 'jose'
import { TextEncoder } from 'util'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'

// Secret exclusivo para os tokens one-time do WebAuthn (separado do JWT principal)
const WEBAUTHN_OTP_SECRET = new TextEncoder().encode(
  process.env.WEBAUTHN_OTP_SECRET || process.env.NEXTAUTH_SECRET || 'webauthn-fallback-secret-change-me'
)

export async function POST(req: NextRequest) {
  const body: AuthenticationResponseJSON = await req.json()

  // Encontrar o authenticator pelo credentialID
  const authenticator = await prisma.webAuthnAuthenticator.findUnique({
    where: { credentialID: body.id },
  })

  if (!authenticator) {
    return NextResponse.json({ error: 'Credencial biométrica não encontrada.' }, { status: 404 })
  }

  // Recuperar challenge válido associado ao usuário
  const challengeRecord = await prisma.webAuthnChallenge.findFirst({
    where: {
      OR: [
        { userId: authenticator.userId },
        { userId: null },
      ],
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!challengeRecord) {
    return NextResponse.json({ error: 'Challenge expirado. Tente novamente.' }, { status: 400 })
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: authenticator.credentialID,
        publicKey: new Uint8Array(authenticator.credentialPublicKey),
        counter: Number(authenticator.counter),
        transports: authenticator.transports as any[],
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Falha na verificação biométrica.' }, { status: 400 })
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Autenticação biométrica não verificada.' }, { status: 401 })
  }

  // Atualizar o counter do authenticator (proteção contra replay)
  await prisma.webAuthnAuthenticator.update({
    where: { id: authenticator.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  })

  // Limpar o challenge usado
  await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } })

  // Limpar challenges expirados (housekeeping)
  await prisma.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})

  // Gerar token one-time (60 segundos) para o credentials provider
  const otp = await new SignJWT({ webauthn: true, userId: authenticator.userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(WEBAUTHN_OTP_SECRET)

  return NextResponse.json({ ok: true, faceToken: otp })
}

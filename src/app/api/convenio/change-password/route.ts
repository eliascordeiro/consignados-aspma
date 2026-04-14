import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { getConvenioSession } from '@/lib/convenio-auth'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function POST(req: Request) {
  const session = await getConvenioSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { currentSenha, newSenha } = await req.json()
  if (!currentSenha) {
    return NextResponse.json({ error: 'Senha atual obrigatória.' }, { status: 400 })
  }
  if (!newSenha || newSenha.length < 4) {
    return NextResponse.json({ error: 'Nova senha deve ter pelo menos 4 caracteres.' }, { status: 400 })
  }

  const convenio = await prisma.convenio.findUnique({
    where: { id: session.convenioId },
    select: {
      id: true,
      senha: true,
      senhaChangedAt: true,
      usuario: true,
      userId: true,
      email: true,
      razao_soc: true,
      fantasia: true,
      tipo: true,
    },
  })
  if (!convenio) {
    return NextResponse.json({ error: 'Convênio não encontrado.' }, { status: 404 })
  }

  // Hard lock: if password hasn't been changed in 60+ days, only admin can unlock
  if (convenio.senhaChangedAt) {
    const daysElapsed =
      (Date.now() - convenio.senhaChangedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysElapsed >= 60) {
      return NextResponse.json({ error: 'conta_bloqueada' }, { status: 403 })
    }
  }

  // Validate current password.
  // There are two login paths that can create a convenio_session:
  //  1. /api/convenio/auth/login — compares against convenio.senha (plain text)
  //  2. NextAuth /api/auth (auth.ts) — user logs in via users table (bcrypt), then
  //     the system finds a linked convenio and sets the convenio_session cookie.
  // We must accept the password if it matches EITHER path.

  // Find linked user via convenio.userId, matching username, or matching email
  // (auth.ts links convênios via userId, usuario, or email)
  const linkedUsers = await prisma.users.findMany({
    where: {
      OR: [
        ...(convenio.userId ? [{ id: convenio.userId }] : []),
        ...(convenio.usuario ? [{ name: { equals: convenio.usuario, mode: 'insensitive' as const } }] : []),
        ...(convenio.email ? [{ email: { equals: convenio.email, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { id: true, password: true, role: true },
  })

  let passwordValid = false

  // Path 1: plain-text match against convenio.senha
  if (convenio.senha === currentSenha) {
    passwordValid = true
  }

  // Path 2: bcrypt match against any linked user's password
  if (!passwordValid) {
    for (const user of linkedUsers) {
      if (await bcrypt.compare(currentSenha, user.password)) {
        passwordValid = true
        break
      }
    }
  }

  if (!passwordValid) {
    return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
  }

  const now = new Date()
  await prisma.convenio.update({
    where: { id: convenio.id },
    data: { senha: newSenha, senhaChangedAt: now },
  })

  // Sync password to all non-ADMIN/MANAGER linked users
  const hashedNewSenha = await bcrypt.hash(newSenha, 10)
  for (const user of linkedUsers) {
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      await prisma.users.update({
        where: { id: user.id },
        data: { password: hashedNewSenha },
      })
    }
  }

  // Issue a fresh JWT cookie so the new senhaChangedAt is reflected immediately
  const newToken = await new SignJWT({
    convenioId: session.convenioId,
    usuario: session.usuario,
    razaoSocial: session.razaoSocial,
    fantasia: session.fantasia,
    tipo: session.tipo,
    senhaChangedAt: now.toISOString(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set('convenio_session', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}

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
      razao_soc: true,
      fantasia: true,
      tipo: true,
      userId: true,
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
  // Path 1: convenio is linked to a users account — password is bcrypt-hashed in users.password.
  // Path 2: standalone convenio — password is stored plaintext in convenio.senha.
  if (convenio.userId) {
    const linkedUser = await prisma.users.findUnique({
      where: { id: convenio.userId },
      select: { password: true },
    })
    if (!linkedUser) {
      return NextResponse.json({ error: 'Usuário vinculado não encontrado.' }, { status: 404 })
    }
    const valid = await bcrypt.compare(currentSenha, linkedUser.password)
    if (!valid) {
      return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
    }
  } else {
    if (convenio.senha !== currentSenha) {
      return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
    }
  }

  const now = new Date()
  await prisma.convenio.update({
    where: { id: convenio.id },
    data: { senha: newSenha, senhaChangedAt: now },
  })

  // For Path 1: also update users.password with bcrypt so NextAuth login works with the new password
  if (convenio.userId) {
    const hashedNewSenha = await bcrypt.hash(newSenha, 10)
    await prisma.users.update({
      where: { id: convenio.userId },
      data: { password: hashedNewSenha },
    })
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

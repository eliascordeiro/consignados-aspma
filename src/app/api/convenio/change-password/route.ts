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
  // Look up user by username (convenio.usuario) — more reliable than convenio.userId
  // which can be set to an org/admin account instead of the actual person's account.
  // Path 1: a users account exists with matching name → bcrypt comparison.
  // Path 2: no matching users account → standalone convenio, plaintext comparison.
  const linkedUser = convenio.usuario
    ? await prisma.users.findFirst({
        where: { name: { equals: convenio.usuario, mode: 'insensitive' } },
        select: { id: true, password: true, role: true },
      })
    : null

  if (linkedUser) {
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

  // For Path 1: also update users.password so NextAuth login accepts the new password.
  // Never update ADMIN/MANAGER passwords this way.
  if (linkedUser && linkedUser.role !== 'ADMIN' && linkedUser.role !== 'MANAGER') {
    const hashedNewSenha = await bcrypt.hash(newSenha, 10)
    await prisma.users.update({
      where: { id: linkedUser.id },
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

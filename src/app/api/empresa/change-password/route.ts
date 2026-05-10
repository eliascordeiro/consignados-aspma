import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'
import { getEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function POST(req: Request) {
  const session = await getEmpresaSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { currentSenha, newSenha } = await req.json()
  if (!currentSenha) {
    return NextResponse.json({ error: 'Senha atual obrigatória.' }, { status: 400 })
  }
  if (!newSenha || newSenha.length < 4) {
    return NextResponse.json(
      { error: 'Nova senha deve ter pelo menos 4 caracteres.' },
      { status: 400 }
    )
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: session.empresaId },
    select: {
      id: true,
      senha: true,
      senhaChangedAt: true,
      email: true,
      nome: true,
      tipo: true,
      diaCorte: true,
    },
  })
  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }

  // Hard lock: 60+ dias sem renovação → só admin desbloqueia
  if (empresa.senhaChangedAt) {
    const daysElapsed =
      (Date.now() - empresa.senhaChangedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysElapsed >= 60) {
      return NextResponse.json({ error: 'conta_bloqueada' }, { status: 403 })
    }
  }

  if (empresa.senha !== currentSenha) {
    return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
  }

  const now = new Date()
  await prisma.empresa.update({
    where: { id: empresa.id },
    data: { senha: newSenha, senhaChangedAt: now },
  })

  // Reemite o JWT com senhaChangedAt atualizado
  const newToken = await new SignJWT({
    empresaId: empresa.id,
    email: empresa.email || '',
    nome: empresa.nome,
    tipo: empresa.tipo || null,
    diaCorte: empresa.diaCorte || 9,
    senhaChangedAt: now.toISOString(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set('empresa_session', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return NextResponse.json({ success: true })
}

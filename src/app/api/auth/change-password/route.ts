import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await req.json()

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { password: true, passwordChangedAt: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  // Hard lock: not null + more than 60 days without renewal
  if (user.passwordChangedAt) {
    const daysElapsed = (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysElapsed >= 60) {
      return NextResponse.json(
        { error: 'conta_bloqueada', message: 'Conta bloqueada por inatividade de senha. Contate o administrador.' },
        { status: 403 }
      )
    }
  }

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) {
    return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 10)

  await prisma.users.update({
    where: { id: session.user.id },
    data: {
      password: hashed,
      passwordChangedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}

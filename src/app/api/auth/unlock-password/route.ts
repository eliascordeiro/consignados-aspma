import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  const role = session?.user?.role

  if (!session?.user?.id || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })
  }

  // MANAGER can only unlock users they created; ADMIN can unlock anyone
  const where =
    role === 'ADMIN'
      ? { id: userId }
      : { id: userId, createdById: session.user.id }

  const target = await prisma.users.findFirst({ where, select: { id: true } })
  if (!target) {
    return NextResponse.json({ error: 'Usuário não encontrado ou sem permissão.' }, { status: 404 })
  }

  await prisma.users.update({
    where: { id: userId },
    data: { passwordChangedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

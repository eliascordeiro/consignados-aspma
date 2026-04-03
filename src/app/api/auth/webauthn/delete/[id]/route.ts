// DELETE /api/auth/webauthn/delete/[id]
// Remove um autenticador biométrico do usuário autenticado.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params

  // Garantir que o autenticador pertence ao usuário logado (evita IDOR)
  const authenticator = await prisma.webAuthnAuthenticator.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!authenticator) {
    return NextResponse.json({ error: 'Autenticador não encontrado.' }, { status: 404 })
  }

  if (authenticator.userId !== session.user.id) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  await prisma.webAuthnAuthenticator.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}

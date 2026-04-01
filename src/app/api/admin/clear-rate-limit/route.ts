import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Rota temporária para limpar login_attempts acumulados.
 * Protegida por NEXTAUTH_SECRET como token.
 * DELETE após resolver o problema de rate limit acumulado.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.NEXTAUTH_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { key } = body as { key?: string }

  if (key) {
    // Limpar tentativas de uma chave específica
    const deleted = await prisma.loginAttempt.deleteMany({ where: { key } })
    return NextResponse.json({ ok: true, deleted: deleted.count, key })
  }

  // Limpar TODAS as tentativas
  const deleted = await prisma.loginAttempt.deleteMany({})
  return NextResponse.json({ ok: true, deleted: deleted.count, message: 'Todas as tentativas removidas' })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.NEXTAUTH_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const attempts = await prisma.loginAttempt.groupBy({
    by: ['key'],
    _count: { key: true },
    orderBy: { _count: { key: 'desc' } },
    take: 20,
  })

  return NextResponse.json({ attempts: attempts.map(a => ({ key: a.key, count: a._count.key })) })
}

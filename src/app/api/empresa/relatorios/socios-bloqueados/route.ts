import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// GET /api/empresa/relatorios/socios-bloqueados
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const items = await prisma.socio.findMany({
    where: {
      empresaId: session.empresaId,
      bloqueio: { not: null },
    },
    select: {
      id: true,
      nome: true,
      cpf: true,
      matricula: true,
      funcao: true,
      lotacao: true,
      celular: true,
      bloqueio: true,
      motivoBloqueio: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ items, total: items.length })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// GET /api/empresa/relatorios/historico-margem?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const inicio = searchParams.get('inicio')
  const fim = searchParams.get('fim')

  const where: any = {
    socio: { empresaId: session.empresaId },
  }
  if (inicio || fim) {
    where.createdAt = {}
    if (inicio) where.createdAt.gte = new Date(inicio + 'T00:00:00')
    if (fim) where.createdAt.lte = new Date(fim + 'T23:59:59')
  }

  const items = await prisma.margemHistorico.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      limiteAnterior: true,
      limiteNovo: true,
      margemAnterior: true,
      margemNova: true,
      motivo: true,
      observacao: true,
      socio: { select: { id: true, nome: true, matricula: true } },
      usuario: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })

  return NextResponse.json({
    items: items.map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      limiteAnterior: h.limiteAnterior != null ? Number(h.limiteAnterior) : null,
      limiteNovo: h.limiteNovo != null ? Number(h.limiteNovo) : null,
      margemAnterior: h.margemAnterior != null ? Number(h.margemAnterior) : null,
      margemNova: h.margemNova != null ? Number(h.margemNova) : null,
      motivo: h.motivo,
      observacao: h.observacao,
      socio: h.socio,
      usuario: h.usuario?.name || null,
    })),
    total: items.length,
  })
}

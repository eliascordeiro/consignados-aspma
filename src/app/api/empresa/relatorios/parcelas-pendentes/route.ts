import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// GET /api/empresa/relatorios/parcelas-pendentes?mes=YYYY-MM
// Lista parcelas pendentes do mês (não baixadas). Padrão: mês atual.
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const mes = request.nextUrl.searchParams.get('mes')
  let inicio: Date
  let fim: Date

  if (mes) {
    const [y, m] = mes.split('-').map(Number)
    inicio = new Date(y, m - 1, 1)
    fim = new Date(y, m, 1)
  } else {
    const now = new Date()
    inicio = new Date(now.getFullYear(), now.getMonth(), 1)
    fim = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  }

  const parcelas = await prisma.parcela.findMany({
    where: {
      venda: { empresaId: session.empresaId, ativo: true, cancelado: false },
      dataVencimento: { gte: inicio, lt: fim },
      baixa: null,
    },
    select: {
      id: true,
      numeroParcela: true,
      dataVencimento: true,
      valor: true,
      venda: {
        select: {
          id: true,
          numeroVenda: true,
          quantidadeParcelas: true,
          socio: { select: { id: true, nome: true, matricula: true } },
        },
      },
    },
    orderBy: { dataVencimento: 'asc' },
    take: 2000,
  })

  const total = parcelas.reduce((a, p) => a + Number(p.valor), 0)

  return NextResponse.json({
    items: parcelas.map((p) => ({
      ...p,
      valor: Number(p.valor),
    })),
    total: parcelas.length,
    totalValor: total,
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
  })
}

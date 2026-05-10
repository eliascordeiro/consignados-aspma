import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// GET /api/empresa/relatorios/vendas-periodo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=ativas|canceladas|todas
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
  const status = searchParams.get('status') || 'ativas'

  if (!inicio || !fim) {
    return NextResponse.json({ error: 'Informe o período (início e fim).' }, { status: 400 })
  }

  const dateInicio = new Date(inicio + 'T00:00:00')
  const dateFim = new Date(fim + 'T23:59:59')

  const where: any = {
    empresaId: session.empresaId,
    dataEmissao: { gte: dateInicio, lte: dateFim },
  }
  if (status === 'ativas') where.cancelado = false
  else if (status === 'canceladas') where.cancelado = true

  const vendas = await prisma.venda.findMany({
    where,
    select: {
      id: true,
      numeroVenda: true,
      dataEmissao: true,
      quantidadeParcelas: true,
      valorParcela: true,
      valorTotal: true,
      cancelado: true,
      ativo: true,
      socio: { select: { id: true, nome: true, matricula: true } },
    },
    orderBy: { dataEmissao: 'desc' },
    take: 1000,
  })

  const totalValor = vendas.reduce((acc, v) => acc + Number(v.valorTotal), 0)

  return NextResponse.json({
    items: vendas.map((v) => ({
      ...v,
      valorParcela: Number(v.valorParcela),
      valorTotal: Number(v.valorTotal),
    })),
    total: vendas.length,
    totalValor,
  })
}

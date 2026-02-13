import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireConvenioSession(request)
    const { id } = await params

    // Verifica se a venda pertence ao conveniado
    const venda = await prisma.venda.findFirst({
      where: {
        id,
        convenioId: session.convenioId,
      },
    })

    if (!venda) {
      return NextResponse.json(
        { error: 'Venda não encontrada' },
        { status: 404 }
      )
    }

    // Busca as parcelas
    const parcelas = await prisma.parcela.findMany({
      where: {
        vendaId: id,
      },
      select: {
        id: true,
        numeroParcela: true,
        dataVencimento: true,
        valor: true,
        baixa: true,
        dataBaixa: true,
      },
      orderBy: {
        numeroParcela: 'asc',
      },
    })

    return NextResponse.json({ parcelas })
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar parcelas' },
      { status: 500 }
    )
  }
}

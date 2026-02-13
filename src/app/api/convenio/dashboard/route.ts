import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)

    // Busca estatísticas do conveniado
    const [
      totalVendas,
      vendasMesAtual,
      valorTotalVendas,
      vendasRecentes,
    ] = await Promise.all([
      // Total de vendas
      prisma.venda.count({
        where: {
          convenioId: session.convenioId,
          ativo: true,
          cancelado: false,
        },
      }),

      // Vendas do mês atual
      prisma.venda.count({
        where: {
          convenioId: session.convenioId,
          ativo: true,
          cancelado: false,
          dataEmissao: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),

      // Valor total de vendas ativas
      prisma.venda.aggregate({
        where: {
          convenioId: session.convenioId,
          ativo: true,
          cancelado: false,
        },
        _sum: {
          valorTotal: true,
        },
      }),

      // Últimas 5 vendas
      prisma.venda.findMany({
        where: {
          convenioId: session.convenioId,
        },
        include: {
          socio: {
            select: {
              nome: true,
              matricula: true,
            },
          },
        },
        orderBy: {
          dataEmissao: 'desc',
        },
        take: 5,
      }),
    ])

    return NextResponse.json({
      stats: {
        totalVendas,
        vendasMesAtual,
        valorTotalVendas: valorTotalVendas._sum.valorTotal || 0,
      },
      vendasRecentes: vendasRecentes.map((venda) => ({
        id: venda.id,
        numeroVenda: venda.numeroVenda,
        dataEmissao: venda.dataEmissao,
        socioNome: venda.socio.nome,
        socioMatricula: venda.socio.matricula,
        valorTotal: venda.valorTotal,
        quantidadeParcelas: venda.quantidadeParcelas,
        ativo: venda.ativo,
        cancelado: venda.cancelado,
      })),
    })
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar dados' },
      { status: 500 }
    )
  }
}

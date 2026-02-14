import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)

    // Mês de referência (mês atual)
    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1 // 1-12
    const anoAtual = hoje.getFullYear()

    // Início e fim do mês atual
    const inicioMesAtual = new Date(anoAtual, mesAtual - 1, 1)
    inicioMesAtual.setHours(0, 0, 0, 0)
    const fimMesAtual = new Date(anoAtual, mesAtual, 0)
    fimMesAtual.setHours(23, 59, 59, 999)

    // Buscar todas as parcelas do conveniado (não canceladas)
    const todasParcelas = await prisma.parcela.findMany({
      where: {
        venda: {
          convenioId: session.convenioId,
          cancelado: false,
        },
      },
      select: {
        id: true,
        valor: true,
        dataVencimento: true,
        venda: {
          select: {
            id: true,
          },
        },
      },
    })

    // Parcelas CANCELADAS (apenas para estatística)
    const parcelasCanceladas = await prisma.parcela.count({
      where: {
        venda: {
          convenioId: session.convenioId,
          cancelado: true,
        },
      },
    })

    const vendasCanceladas = await prisma.venda.count({
      where: {
        convenioId: session.convenioId,
        cancelado: true,
      },
    })

    // Separar parcelas por período de vencimento
    const parcelasMesAtual = todasParcelas.filter(p => {
      const venc = new Date(p.dataVencimento)
      return venc >= inicioMesAtual && venc <= fimMesAtual
    })

    const parcelasMesesAnteriores = todasParcelas.filter(p => {
      const venc = new Date(p.dataVencimento)
      return venc < inicioMesAtual
    })

    const parcelasMesesFuturos = todasParcelas.filter(p => {
      const venc = new Date(p.dataVencimento)
      return venc > fimMesAtual
    })

    // Calcular valores
    const valorMesAtual = parcelasMesAtual.reduce((sum, p) => sum + Number(p.valor), 0)
    const valorMesesAnteriores = parcelasMesesAnteriores.reduce((sum, p) => sum + Number(p.valor), 0)
    const valorMesesFuturos = parcelasMesesFuturos.reduce((sum, p) => sum + Number(p.valor), 0)

    // Total de vendas ativas (não canceladas)
    const totalVendasAtivas = await prisma.venda.count({
      where: {
        convenioId: session.convenioId,
        cancelado: false,
      },
    })

    // Vendas registradas este mês (por data de emissão)
    const vendasRegistradasMes = await prisma.venda.count({
      where: {
        convenioId: session.convenioId,
        dataEmissao: {
          gte: inicioMesAtual,
          lte: fimMesAtual,
        },
      },
    })

    // Últimas 10 vendas
    const vendasRecentes = await prisma.venda.findMany({
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
      take: 10,
    })

    return NextResponse.json({
      stats: {
        // Descontos do mês atual
        parcelasMesAtual: parcelasMesAtual.length,
        valorMesAtual,

        // Meses anteriores (já recebidos)
        parcelasMesesAnteriores: parcelasMesesAnteriores.length,
        valorMesesAnteriores,

        // Meses futuros (a receber)
        parcelasMesesFuturos: parcelasMesesFuturos.length,
        valorMesesFuturos,

        // Vendas canceladas
        vendasCanceladas,
        parcelasCanceladas,

        // Totais
        totalVendasAtivas,
        vendasRegistradasMes,

        // Referência do mês
        mesReferencia: `${mesAtual.toString().padStart(2, '0')}/${anoAtual}`,
      },
      vendasRecentes: vendasRecentes.map((venda) => ({
        id: venda.id,
        numeroVenda: venda.numeroVenda,
        dataEmissao: venda.dataEmissao,
        socioNome: venda.socio.nome,
        socioMatricula: venda.socio.matricula,
        valorTotal: venda.valorTotal,
        quantidadeParcelas: venda.quantidadeParcelas,
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

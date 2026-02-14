import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)

    // Data de corte: primeiro dia do mês atual
    const dataCorte = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    dataCorte.setHours(0, 0, 0, 0)

    // Buscar todas as parcelas do conveniado para calcular os totais
    const parcelas = await prisma.parcela.findMany({
      where: {
        venda: {
          convenioId: session.convenioId,
        },
      },
      select: {
        id: true,
        valor: true,
        dataVencimento: true,
        venda: {
          select: {
            id: true,
            cancelado: true,
          },
        },
      },
    })

    // Separar parcelas por categoria
    const parcelasAtivas = parcelas.filter(
      p => !p.venda.cancelado && new Date(p.dataVencimento) >= dataCorte
    )
    const parcelasQuitadas = parcelas.filter(
      p => !p.venda.cancelado && new Date(p.dataVencimento) < dataCorte
    )
    const parcelasCanceladas = parcelas.filter(p => p.venda.cancelado)

    // Calcular totais
    const valorAtivo = parcelasAtivas.reduce((sum, p) => sum + Number(p.valor), 0)
    const valorQuitado = parcelasQuitadas.reduce((sum, p) => sum + Number(p.valor), 0)
    const valorCancelado = parcelasCanceladas.reduce((sum, p) => sum + Number(p.valor), 0)

    // Contar vendas únicas em cada categoria
    const vendasAtivasIds = new Set(parcelasAtivas.map(p => p.venda.id))
    const vendasQuitadasIds = new Set(parcelasQuitadas.map(p => p.venda.id))
    const vendasCanceladasIds = new Set(parcelasCanceladas.map(p => p.venda.id))

    // Vendas do mês atual (data de emissão no mês atual)
    const vendasMesAtual = await prisma.venda.count({
      where: {
        convenioId: session.convenioId,
        cancelado: false,
        dataEmissao: {
          gte: dataCorte,
        },
      },
    })

    // Últimas 10 vendas para mostrar no dashboard
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
        parcelas: {
          select: {
            id: true,
            dataVencimento: true,
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
        // Vendas ativas (com parcelas >= data de corte)
        vendasAtivas: vendasAtivasIds.size,
        parcelasAtivas: parcelasAtivas.length,
        valorAtivo,

        // Vendas quitadas (todas as parcelas < data de corte)
        vendasQuitadas: vendasQuitadasIds.size,
        parcelasQuitadas: parcelasQuitadas.length,
        valorQuitado,

        // Vendas canceladas
        vendasCanceladas: vendasCanceladasIds.size,
        parcelasCanceladas: parcelasCanceladas.length,
        valorCancelado,

        // Vendas deste mês (por data de emissão)
        vendasMesAtual,

        // Data de corte para referência
        dataCorte: dataCorte.toISOString(),
      },
      vendasRecentes: vendasRecentes.map((venda) => {
        // Classificar a venda baseado nas parcelas
        let status: 'ativa' | 'quitada' | 'cancelada' = 'quitada'
        
        if (venda.cancelado) {
          status = 'cancelada'
        } else {
          const temParcelasFuturas = venda.parcelas.some(
            p => new Date(p.dataVencimento) >= dataCorte
          )
          status = temParcelasFuturas ? 'ativa' : 'quitada'
        }

        return {
          id: venda.id,
          numeroVenda: venda.numeroVenda,
          dataEmissao: venda.dataEmissao,
          socioNome: venda.socio.nome,
          socioMatricula: venda.socio.matricula,
          valorTotal: venda.valorTotal,
          quantidadeParcelas: venda.quantidadeParcelas,
          status,
        }
      }),
    })
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar dados' },
      { status: 500 }
    )
  }
}

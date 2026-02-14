import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConvenioSession } from '@/lib/convenio-auth'
import { createAuditLog } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  try {
    const session = await getConvenioSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const convenio = { id: session.convenioId }

    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    if (!dataInicio || !dataFim) {
      return NextResponse.json(
        { error: 'dataInicio e dataFim são obrigatórios' },
        { status: 400 }
      )
    }

    const inicio = new Date(dataInicio)
    inicio.setHours(0, 0, 0, 0)
    
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    // Buscar vendas do período
    const vendas = await prisma.venda.findMany({
      where: {
        convenioId: convenio.id,
        dataEmissao: {
          gte: inicio,
          lte: fim,
        },
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
            baixa: true,
            valor: true,
          },
        },
      },
      orderBy: {
        dataEmissao: 'desc',
      },
    })

    // Calcular estatísticas
    const totalVendas = vendas.length
    const valorTotal = vendas.reduce((sum, v) => sum + Number(v.valorTotal), 0)
    const totalParcelas = vendas.reduce((sum, v) => sum + v.quantidadeParcelas, 0)
    const ticketMedio = totalVendas > 0 ? valorTotal / totalVendas : 0
    
    const vendasAtivas = vendas.filter(v => v.ativo && !v.cancelado).length
    const vendasQuitadas = vendas.filter(v => v.quitada).length
    const vendasCanceladas = vendas.filter(v => v.cancelado).length

    // Valor já recebido (parcelas pagas)
    const valorRecebido = vendas.reduce((sum, v) => {
      const parcelasPagas = v.parcelas.filter(p => p.baixa === 'S')
      return sum + parcelasPagas.reduce((s, p) => s + Number(p.valor), 0)
    }, 0)

    // Vendas por dia
    const vendasPorDia = vendas.reduce((acc, venda) => {
      const dia = new Date(venda.dataEmissao).toISOString().split('T')[0]
      if (!acc[dia]) {
        acc[dia] = { quantidade: 0, valor: 0 }
      }
      acc[dia].quantidade++
      acc[dia].valor += Number(venda.valorTotal)
      return acc
    }, {} as Record<string, { quantidade: number; valor: number }>)

    const vendasPorDiaArray = Object.entries(vendasPorDia)
      .map(([data, info]) => ({
        data,
        quantidade: info.quantidade,
        valor: info.valor,
      }))
      .sort((a, b) => a.data.localeCompare(b.data))

    // Log de auditoria
    await createAuditLog({
      usuarioId: null,
      convenioId: convenio.id,
      acao: 'VIEW',
      entidade: 'relatorio_vendas_periodo',
      descricao: `Visualizou relatório de vendas do período ${dataInicio} a ${dataFim}`,
      metadados: {
        dataInicio,
        dataFim,
        totalVendas,
      },
    })

    return NextResponse.json({
      periodo: {
        inicio: dataInicio,
        fim: dataFim,
      },
      resumo: {
        totalVendas,
        valorTotal,
        totalParcelas,
        ticketMedio,
        vendasAtivas,
        vendasQuitadas,
        vendasCanceladas,
        valorRecebido,
        valorAReceber: valorTotal - valorRecebido,
      },
      vendasPorDia: vendasPorDiaArray,
      vendas: vendas.map(v => ({
        id: v.id,
        numeroVenda: v.numeroVenda,
        dataEmissao: v.dataEmissao,
        socio: v.socio.nome,
        matricula: v.socio.matricula,
        valorTotal: v.valorTotal,
        quantidadeParcelas: v.quantidadeParcelas,
        valorParcela: v.valorParcela,
        status: v.cancelado ? 'cancelada' : v.quitada ? 'quitada' : 'ativa',
      })),
    })
  } catch (error) {
    console.error('Erro ao buscar relatório de vendas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar relatório de vendas' },
      { status: 500 }
    )
  }
}

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

    const convenioId = session.convenioId

    // Buscar desconto do convênio
    const convenioData = await prisma.convenio.findUnique({
      where: { id: convenioId },
      select: { id: true, desconto: true },
    })
    const descontoPorParcela = Number(convenioData?.desconto ?? 0)

    const { searchParams } = new URL(request.url)
    const mesVencimento = searchParams.get('mesVencimento') // formato: YYYY-MM

    if (!mesVencimento) {
      return NextResponse.json(
        { error: 'mesVencimento é obrigatório (formato: YYYY-MM)' },
        { status: 400 }
      )
    }

    const [ano, mes] = mesVencimento.split('-').map(Number)
    const dataInicio = new Date(ano, mes - 1, 1)
    dataInicio.setHours(0, 0, 0, 0)
    
    const dataFim = new Date(ano, mes, 0)
    dataFim.setHours(23, 59, 59, 999)

    // Limite de 3 anos: apenas parcelas de vendas dos últimos 3 anos
    const tresAnosAtras = new Date()
    tresAnosAtras.setFullYear(tresAnosAtras.getFullYear() - 3)
    tresAnosAtras.setHours(0, 0, 0, 0)

    // Buscar parcelas do período
    const parcelas = await prisma.parcela.findMany({
      where: {
        dataVencimento: {
          gte: dataInicio,
          lte: dataFim,
        },
        venda: {
          convenioId: convenioId,
          ativo: true,
          cancelado: false,
          dataEmissao: { gte: tresAnosAtras },
        },
      },
      include: {
        venda: {
          select: {
            numeroVenda: true,
            quantidadeParcelas: true,
            dataEmissao: true,
            socio: {
              select: {
                nome: true,
                matricula: true,
                cpf: true,
              },
            },
          },
        },
      },
      orderBy: [
        { dataVencimento: 'asc' },
        { venda: { numeroVenda: 'asc' } },
      ],
    })

    // Calcular estatísticas
    const totalParcelas = parcelas.length
    const valorTotal = parcelas.reduce((sum, p) => sum + Number(p.valor), 0)
    const totalDesconto = valorTotal * descontoPorParcela / 100
    const valorLiquido = valorTotal - totalDesconto

    const parcelasPagas = parcelas.filter(p => p.baixa === 'S')
    const parcelasPendentes = parcelas.filter(p => p.baixa !== 'S')
    
    const valorPago = parcelasPagas.reduce((sum, p) => sum + Number(p.valor), 0)
    const valorPendente = parcelasPendentes.reduce((sum, p) => sum + Number(p.valor), 0)

    // Agrupar por data de vencimento
    const parcelasPorDia = parcelas.reduce((acc, parcela) => {
      const dia = new Date(parcela.dataVencimento).toISOString().split('T')[0]
      if (!acc[dia]) {
        acc[dia] = { quantidade: 0, valor: 0, pagas: 0, pendentes: 0 }
      }
      acc[dia].quantidade++
      acc[dia].valor += Number(parcela.valor)
      if (parcela.baixa === 'S') {
        acc[dia].pagas++
      } else {
        acc[dia].pendentes++
      }
      return acc
    }, {} as Record<string, { quantidade: number; valor: number; pagas: number; pendentes: number }>)

    const parcelasPorDiaArray = Object.entries(parcelasPorDia)
      .map(([data, info]) => ({
        data,
        quantidade: info.quantidade,
        valor: info.valor,
        pagas: info.pagas,
        pendentes: info.pendentes,
      }))
      .sort((a, b) => a.data.localeCompare(b.data))

    // Log de auditoria
    await createAuditLog({
      userId: 'convenio-' + session.convenioId,
      userName: session.usuario,
      userRole: 'CONVENIO',
      action: 'VIEW',
      module: 'vendas',
      description: `Visualizou relatório de parcelas do mês ${mesVencimento}`,
      metadata: {
        convenioId: session.convenioId,
        mesVencimento,
        totalParcelas,
      },
    })

    return NextResponse.json({
      periodo: {
        mesVencimento,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
      },
      resumo: {
        totalParcelas,
        valorTotal,
        descontoPorParcela,
        totalDesconto,
        valorLiquido,
        parcelasPagas: parcelasPagas.length,
        valorPago,
        parcelasPendentes: parcelasPendentes.length,
        valorPendente,
        percentualPago: totalParcelas > 0 ? (parcelasPagas.length / totalParcelas) * 100 : 0,
      },
      parcelasPorDia: parcelasPorDiaArray,
      parcelas: parcelas.map(p => ({
        id: p.id,
        numeroParcela: p.numeroParcela,
        dataVencimento: p.dataVencimento,
        valor: p.valor,
        baixa: p.baixa,
        dataBaixa: p.dataBaixa,
        venda: {
          numeroVenda: p.venda.numeroVenda,
          quantidadeParcelas: p.venda.quantidadeParcelas,
          dataEmissao: p.venda.dataEmissao,
          socio: p.venda.socio.nome,
          matricula: p.venda.socio.matricula,
          cpf: p.venda.socio.cpf,
        },
      })),
    })
  } catch (error) {
    console.error('Erro ao buscar relatório de parcelas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar relatório de parcelas' },
      { status: 500 }
    )
  }
}

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

    const convenioData = await prisma.convenio.findUnique({
      where: { id: convenioId },
      select: { desconto: true },
    })
    const descontoPorParcela = Number(convenioData?.desconto ?? 0)

    // Todas as vendas ativas (não canceladas) do convênio, sem limite de data
    const vendas = await prisma.venda.findMany({
      where: { convenioId, ativo: true, cancelado: false },
      include: {
        socio: { select: { nome: true, matricula: true, cpf: true } },
        parcelas: {
          select: {
            id: true,
            numeroParcela: true,
            dataVencimento: true,
            valor: true,
            baixa: true,
            dataBaixa: true,
          },
          orderBy: { numeroParcela: 'asc' },
        },
      },
      orderBy: [{ socio: { nome: 'asc' } }, { dataEmissao: 'asc' }],
    })

    // Acumular por sócio
    const porSocio: Record<string, {
      nome: string
      matricula: string | null
      cpf: string | null
      vendas: number
      totalVendas: number
      parcelasPagas: number
      parcelasPendentes: number
      valorPago: number
      valorPendente: number
      proximoVencimento: string | null
    }> = {}

    const vendasDetalhadas = vendas.map(v => {
      const pagas = v.parcelas.filter(p => p.baixa === 'S')
      const pendentes = v.parcelas.filter(p => p.baixa !== 'S')
      const valorPago = pagas.reduce((s, p) => s + Number(p.valor), 0)
      // Usa valorTotal da venda menos o que foi pago para evitar diferença de arredondamento
      const valorPendente = Math.max(0, Number(v.valorTotal) - valorPago)
      const proximaParcela = [...pendentes].sort(
        (a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()
      )[0]

      const socioKey = v.socio.matricula || v.socio.cpf || v.socio.nome
      if (!porSocio[socioKey]) {
        porSocio[socioKey] = {
          nome: v.socio.nome,
          matricula: v.socio.matricula,
          cpf: v.socio.cpf,
          vendas: 0,
          totalVendas: 0,
          parcelasPagas: 0,
          parcelasPendentes: 0,
          valorPago: 0,
          valorPendente: 0,
          proximoVencimento: null,
        }
      }
      const s = porSocio[socioKey]
      s.vendas++
      s.totalVendas += Number(v.valorTotal)
      s.parcelasPagas += pagas.length
      s.parcelasPendentes += pendentes.length
      s.valorPago += valorPago
      s.valorPendente += valorPendente
      if (proximaParcela) {
        const dt = new Date(proximaParcela.dataVencimento).toISOString()
        if (!s.proximoVencimento || dt < s.proximoVencimento) {
          s.proximoVencimento = dt
        }
      }

      return {
        id: v.id,
        numeroVenda: v.numeroVenda,
        dataEmissao: v.dataEmissao,
        socio: v.socio.nome,
        matricula: v.socio.matricula,
        cpf: v.socio.cpf,
        valorTotal: Number(v.valorTotal),
        quantidadeParcelas: v.quantidadeParcelas,
        valorParcela: Number(v.valorParcela),
        parcelasPagas: pagas.length,
        parcelasPendentes: pendentes.length,
        valorPago,
        valorPendente,
        proximoVencimento: proximaParcela?.dataVencimento ?? null,
      }
    })

    const totalGeral = vendas.reduce((s, v) => s + Number(v.valorTotal), 0)
    const totalPago = vendasDetalhadas.reduce((s, v) => s + v.valorPago, 0)
    const totalPendente = vendasDetalhadas.reduce((s, v) => s + v.valorPendente, 0)
    const totalDesconto = totalPendente * descontoPorParcela / 100
    const totalLiquido = totalPendente - totalDesconto

    await createAuditLog({
      userId: 'convenio-' + session.convenioId,
      userName: session.usuario,
      userRole: 'CONVENIO',
      action: 'VIEW',
      module: 'vendas',
      description: `Visualizou relatório de posição financeira`,
      metadata: { convenioId: session.convenioId, totalVendas: vendas.length },
    })

    return NextResponse.json({
      resumo: {
        totalVendas: vendas.length,
        totalSocios: Object.keys(porSocio).length,
        totalGeral,
        totalPago,
        totalPendente,
        totalDesconto,
        totalLiquido,
        descontoPorParcela,
      },
      socios: Object.values(porSocio).sort((a, b) => b.valorPendente - a.valorPendente),
      vendas: vendasDetalhadas,
    })
  } catch (error) {
    console.error('Erro ao buscar posição financeira:', error)
    return NextResponse.json({ error: 'Erro ao buscar posição financeira' }, { status: 500 })
  }
}

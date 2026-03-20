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

    // Buscar todas as parcelas do conveniado (não canceladas, excluindo vendas com valor zerado)
    const todasParcelas = await prisma.parcela.findMany({
      where: {
        venda: {
          convenioId: session.convenioId,
          cancelado: false,
          valorTotal: { gt: 0 },
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

    // Total de vendas em andamento (com parcelas no mês atual ou futuro)
    const totalVendasEmAndamento = await prisma.venda.count({
      where: {
        convenioId: session.convenioId,
        cancelado: false,
        parcelas: {
          some: {
            dataVencimento: {
              gte: inicioMesAtual,
            },
          },
        },
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

    // Dados do perfil do convênio
    const convenio = await prisma.convenio.findUnique({
      where: { id: session.convenioId },
      select: {
        razao_soc: true,
        fantasia: true,
        nome: true,
        cnpj: true,
        cgc: true,
        desconto: true,
        parcelas: true,
        endereco: true,
        bairro: true,
        cep: true,
        cidade: true,
        estado: true,
        uf: true,
        telefone: true,
        fone: true,
        fax: true,
        contato: true,
        email: true,
        banco: true,
        agencia: true,
        conta: true,
        libera: true,
        tipo: true,
      },
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
        totalVendasEmAndamento,
        vendasRegistradasMes,

        // Referência do mês
        mesReferencia: `${mesAtual.toString().padStart(2, '0')}/${anoAtual}`,
      },
      perfil: {
        razaoSocial: convenio?.razao_soc ?? null,
        fantasia: convenio?.fantasia ?? null,
        nome: convenio?.nome ?? null,
        cnpj: convenio?.cnpj ?? convenio?.cgc ?? null,
        desconto: convenio?.desconto != null ? Number(convenio.desconto) : null,
        parcelas: convenio?.parcelas ?? null,
        endereco: convenio?.endereco ?? null,
        bairro: convenio?.bairro ?? null,
        cep: convenio?.cep ?? null,
        cidade: convenio?.cidade ?? null,
        estado: convenio?.estado ?? convenio?.uf ?? null,
        telefone: convenio?.telefone ?? convenio?.fone ?? null,
        fax: convenio?.fax ?? null,
        contato: convenio?.contato ?? null,
        email: convenio?.email ?? null,
        banco: convenio?.banco ?? null,
        agencia: convenio?.agencia ?? null,
        conta: convenio?.conta ?? null,
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

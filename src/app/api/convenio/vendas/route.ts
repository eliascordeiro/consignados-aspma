import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)
    const body = await request.json()

    const {
      socioId,
      valorTotal,
      quantidadeParcelas,
      valorParcela,
      observacoes,
    } = body

    // Validações
    if (!socioId || !valorTotal || !quantidadeParcelas || !valorParcela) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Verifica se o sócio existe, está ativo e sem bloqueio
    const socio = await prisma.socio.findFirst({
      where: {
        id: socioId,
        ativo: true,
        OR: [
          { bloqueio: null },
          { bloqueio: '' },
          { bloqueio: 'N' },
        ],
      },
    })

    if (!socio) {
      return NextResponse.json(
        { error: 'Sócio não encontrado, inativo ou bloqueado' },
        { status: 404 }
      )
    }

    // Busca o maior número de venda do sócio
    const ultimaVenda = await prisma.venda.findFirst({
      where: { socioId },
      orderBy: { numeroVenda: 'desc' },
      select: { numeroVenda: true },
    })

    const numeroVenda = (ultimaVenda?.numeroVenda || 0) + 1

    // Cria a venda
    const venda = await prisma.venda.create({
      data: {
        socioId,
        convenioId: session.convenioId,
        numeroVenda,
        valorTotal,
        quantidadeParcelas,
        valorParcela,
        observacoes,
        userId: 'convenio-' + session.convenioId, // ID virtual para vendas de conveniados
        operador: session.usuario,
        ativo: true,
        cancelado: false,
      },
    })

    // Cria as parcelas
    const dataAtual = new Date()
    const parcelas = []

    for (let i = 1; i <= quantidadeParcelas; i++) {
      const dataVencimento = new Date(dataAtual)
      dataVencimento.setMonth(dataVencimento.getMonth() + i)

      parcelas.push({
        vendaId: venda.id,
        numeroParcela: i,
        dataVencimento,
        valor: valorParcela,
        baixa: 'N',
      })
    }

    await prisma.parcela.createMany({
      data: parcelas,
    })

    return NextResponse.json({
      success: true,
      venda: {
        id: venda.id,
        numeroVenda: venda.numeroVenda,
        valorTotal: venda.valorTotal,
        quantidadeParcelas: venda.quantidadeParcelas,
      },
    })
  } catch (error) {
    console.error('Erro ao criar venda:', error)
    return NextResponse.json(
      { error: 'Erro ao criar venda' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)

    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca')?.trim() || ''
    const status = searchParams.get('status') || '' // ativa, cancelada, quitada
    const dataInicio = searchParams.get('dataInicio') || ''
    const dataFim = searchParams.get('dataFim') || ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      convenioId: session.convenioId,
    }

    // Filtro por nome ou matrícula do sócio
    if (busca) {
      where.socio = {
        OR: [
          { nome: { contains: busca, mode: 'insensitive' } },
          { matricula: { contains: busca, mode: 'insensitive' } },
          { cpf: { contains: busca, mode: 'insensitive' } },
        ],
      }
    }

    // Filtro por status
    if (status === 'ativa') {
      where.ativo = true
      where.cancelado = false
    } else if (status === 'cancelada') {
      where.cancelado = true
    }

    // Filtro por data
    if (dataInicio || dataFim) {
      where.dataEmissao = {}
      if (dataInicio) {
        where.dataEmissao.gte = new Date(dataInicio + 'T00:00:00.000Z')
      }
      if (dataFim) {
        where.dataEmissao.lte = new Date(dataFim + 'T23:59:59.999Z')
      }
    }

    // Busca vendas com agregação de parcelas pagas (otimizado)
    const vendas = await prisma.venda.findMany({
      where,
      include: {
        socio: {
          select: {
            nome: true,
            matricula: true,
            cpf: true,
          },
        },
        parcelas: {
          select: {
            baixa: true,
          },
        },
      },
      orderBy: {
        dataEmissao: 'desc',
      },
    })

    // Formata resposta com contagem de parcelas pagas
    const vendasFormatadas = vendas.map(venda => {
      const parcelasPagas = venda.parcelas.filter(p => p.baixa === 'S').length
      const quitada = parcelasPagas === venda.quantidadeParcelas

      return {
        id: venda.id,
        numeroVenda: venda.numeroVenda,
        dataEmissao: venda.dataEmissao,
        valorTotal: venda.valorTotal,
        quantidadeParcelas: venda.quantidadeParcelas,
        valorParcela: venda.valorParcela,
        observacoes: venda.observacoes,
        ativo: venda.ativo,
        cancelado: venda.cancelado,
        socio: venda.socio,
        parcelasPagas,
        quitada,
      }
    })

    // Filtro pós-query para "quitada" (depende da contagem de parcelas)
    let resultado = vendasFormatadas
    if (status === 'quitada') {
      resultado = vendasFormatadas.filter(v => v.quitada && !v.cancelado)
    }

    return NextResponse.json({ vendas: resultado })
  } catch (error) {
    console.error('Erro ao buscar vendas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar vendas' },
      { status: 500 }
    )
  }
}

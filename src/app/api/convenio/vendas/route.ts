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

    // Busca vendas com agregação de parcelas pagas (otimizado)
    const vendas = await prisma.venda.findMany({
      where: {
        convenioId: session.convenioId,
      },
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
    const vendasFormatadas = vendas.map(venda => ({
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
      parcelasPagas: venda.parcelas.filter(p => p.baixa === 'S').length,
    }))

    return NextResponse.json({ vendas: vendasFormatadas })
  } catch (error) {
    console.error('Erro ao buscar vendas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar vendas' },
      { status: 500 }
    )
  }
}

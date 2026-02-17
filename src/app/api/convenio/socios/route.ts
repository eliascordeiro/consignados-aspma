import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'

export async function GET(request: NextRequest) {
  try {
    await requireConvenioSession(request)

    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca') || ''

    // Busca sócios ativos e sem bloqueio
    // Por segurança: busca apenas por matrícula EXATA ou CPF EXATO
    const buscaTrimmed = busca.trim()
    const buscaLimpa = buscaTrimmed.replace(/\D/g, '') // Somente números

    // Formatar CPF para comparação: 12345678900 → 123.456.789-00
    const cpfFormatado = buscaLimpa.length === 11
      ? `${buscaLimpa.slice(0,3)}.${buscaLimpa.slice(3,6)}.${buscaLimpa.slice(6,9)}-${buscaLimpa.slice(9,11)}`
      : null

    const socios = await prisma.socio.findMany({
      where: {
        ativo: true,
        OR: [
          { bloqueio: null },
          { bloqueio: '' },
          { bloqueio: 'N' },
        ],
        AND: buscaLimpa ? {
          OR: [
            { matricula: { equals: buscaLimpa } },
            { matricula: { equals: buscaTrimmed } },
            { cpf: { equals: buscaLimpa } },
            { cpf: { equals: buscaTrimmed } },
            ...(cpfFormatado ? [{ cpf: { equals: cpfFormatado } }] : []),
          ],
        } : undefined,
      },
      select: {
        id: true,
        nome: true,
        matricula: true,
        cpf: true,
        celular: true,
        telefone: true,
        margemConsig: true,
        limite: true,
        tipo: true,
        empresa: {
          select: {
            nome: true,
          },
        },
      },
      orderBy: {
        nome: 'asc',
      },
      take: 50, // Limita a 50 resultados
    })

    return NextResponse.json({
      socios: socios.map((socio) => ({
        id: socio.id,
        nome: socio.nome,
        matricula: socio.matricula,
        cpf: socio.cpf,
        celular: socio.celular,
        telefone: socio.telefone,
        margemConsig: socio.margemConsig,
        limite: socio.limite,
        tipo: socio.tipo,
        empresaNome: socio.empresa?.nome,
      })),
    })
  } catch (error) {
    console.error('Erro ao buscar sócios:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar sócios' },
      { status: 500 }
    )
  }
}

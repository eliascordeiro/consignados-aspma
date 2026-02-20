import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'

/**
 * @swagger
 * /api/convenio/socios:
 *   get:
 *     summary: Busca sócios por matrícula ou CPF
 *     description: |
 *       Busca sócios ativos e sem bloqueio por matrícula exata ou CPF exato.
 *       
 *       **Características:**
 *       - Busca apenas sócios ativos
 *       - Exclui sócios com bloqueio
 *       - Aceita CPF formatado (123.456.789-00) ou apenas números (12345678900)
 *       - Aceita matrícula com ou sem formatação
 *       - Retorna até 50 resultados
 *     tags:
 *       - Consulta de Margem
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: busca
 *         required: false
 *         schema:
 *           type: string
 *         description: Matrícula ou CPF do sócio (com ou sem formatação)
 *         examples:
 *           matricula:
 *             value: "12345"
 *             summary: Busca por matrícula
 *           cpfFormatado:
 *             value: "123.456.789-00"
 *             summary: Busca por CPF formatado
 *           cpfNumeros:
 *             value: "12345678900"
 *             summary: Busca por CPF sem formatação
 *     responses:
 *       200:
 *         description: Lista de sócios encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 socios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: ID do sócio (UUID)
 *                       nome:
 *                         type: string
 *                         description: Nome completo do sócio
 *                       matricula:
 *                         type: string
 *                         description: Matrícula do sócio
 *                       cpf:
 *                         type: string
 *                         description: CPF do sócio
 *                       celular:
 *                         type: string
 *                         description: Número do celular
 *                       telefone:
 *                         type: string
 *                         description: Número do telefone
 *                       margemConsig:
 *                         type: number
 *                         format: float
 *                         description: Margem consignável
 *                       limite:
 *                         type: number
 *                         format: float
 *                         description: Limite de crédito
 *                       tipo:
 *                         type: string
 *                         description: Tipo do sócio
 *                       empresaNome:
 *                         type: string
 *                         description: Nome da empresa vinculada
 *             example:
 *               socios:
 *                 - id: "550e8400-e29b-41d4-a716-446655440000"
 *                   nome: "João da Silva"
 *                   matricula: "12345"
 *                   cpf: "123.456.789-00"
 *                   celular: "(41) 99999-9999"
 *                   telefone: "(41) 3333-3333"
 *                   margemConsig: 1500.00
 *                   limite: 2000.00
 *                   tipo: "1"
 *                   empresaNome: "ASPMA"
 *       401:
 *         description: Não autorizado - É necessário fazer login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

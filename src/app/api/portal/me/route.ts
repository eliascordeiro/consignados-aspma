import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

async function getSocioId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('portal_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.socioId as string
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const socioId = await getSocioId(request)
  if (!socioId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: {
      id: true,
      nome: true,
      cpf: true,
      rg: true,
      matricula: true,
      funcao: true,
      lotacao: true,
      endereco: true,
      bairro: true,
      cep: true,
      cidade: true,
      uf: true,
      telefone: true,
      celular: true,
      email: true,
      dataAdmissao: true,
      dataNascimento: true,
      limite: true,
      margemConsig: true,
      bloqueio: true,
      tipo: true,
      codTipo: true,
      agencia: true,
      conta: true,
      banco: true,
      empresa: { select: { nome: true, diaCorte: true } },
      vendas: {
        where: { ativo: true, cancelado: false },
        select: {
          id: true,
          numeroVenda: true,
          dataEmissao: true,
          quantidadeParcelas: true,
          valorParcela: true,
          valorTotal: true,
          convenio: { select: { razao_soc: true, codigo: true } },
          parcelas: {
            select: {
              id: true,
              numeroParcela: true,
              dataVencimento: true,
              valor: true,
              baixa: true,
              dataBaixa: true,
              valorPago: true,
            },
            orderBy: { numeroParcela: 'asc' },
          },
        },
        orderBy: { dataEmissao: 'desc' },
      },
    },
  })

  if (!socio) return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })
  return NextResponse.json(socio)
}

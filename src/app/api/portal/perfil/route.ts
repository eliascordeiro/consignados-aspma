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
      sexo: true,
      estadoCivil: true,
      banco: true,
      agencia: true,
      conta: true,
      tipo: true,
      empresa: { select: { nome: true } },
    },
  })

  if (!socio) return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })

  return NextResponse.json(socio)
}

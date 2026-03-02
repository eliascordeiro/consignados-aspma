import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function normalizar(valor: string) {
  return valor.replace(/\D/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const { identificador } = await request.json()
    if (!identificador) {
      return NextResponse.json({ error: 'Identificador obrigatório' }, { status: 400 })
    }

    const id = identificador.trim()
    const idLimpo = normalizar(id)

    const socio = await prisma.socio.findFirst({
      where: {
        ativo: true,
        OR: [
          { email: id },
          { cpf: idLimpo },
          { cpf: id },
          { celular: idLimpo },
          { celular: id },
        ],
      },
      select: { id: true, nome: true },
    })

    if (!socio) {
      return NextResponse.json({ error: 'Sócio não encontrado. Verifique CPF, e-mail ou celular.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, nome: socio.nome.split(' ')[0] })
  } catch (error) {
    console.error('[primeiro-acesso/verificar]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function normalizar(valor: string) {
  return valor.replace(/\D/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const { identificador, senha } = await request.json()

    if (!identificador || !senha) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
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
      select: { id: true, nome: true, senha: true },
    })

    if (!socio) {
      return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })
    }

    const hash = await bcrypt.hash(senha, 12)

    await prisma.socio.update({
      where: { id: socio.id },
      data: { senha: hash },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[primeiro-acesso/senha]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

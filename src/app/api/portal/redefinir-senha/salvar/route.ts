import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const { confirmedToken, senha } = await request.json()

    if (!confirmedToken || !senha) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    // Verificar confirmed token
    let payload: { socioId: string; type: string }
    try {
      const result = await jwtVerify(confirmedToken, JWT_SECRET)
      payload = result.payload as typeof payload
    } catch {
      return NextResponse.json({ error: 'Sessão expirada. Reinicie o processo.' }, { status: 401 })
    }

    if (payload.type !== 'otp_confirmed') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const hash = await bcrypt.hash(senha, 12)

    await prisma.socio.update({
      where: { id: payload.socioId },
      data: { senha: hash },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[salvar-senha]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

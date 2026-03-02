import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

// Normaliza CPF/celular removendo pontuação
function normalizar(valor: string) {
  return valor.replace(/\D/g, '')
}

export async function POST(request: NextRequest) {
  try {
    const { identificador, senha } = await request.json()

    if (!identificador || !senha) {
      return NextResponse.json({ error: 'Identificador e senha são obrigatórios' }, { status: 400 })
    }

    const id = identificador.trim()
    const idLimpo = normalizar(id)

    // Busca por email, CPF ou celular
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
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        celular: true,
        matricula: true,
        senha: true,
        bloqueio: true,
        motivoBloqueio: true,
        ativo: true,
      },
    })

    if (!socio) {
      return NextResponse.json({ error: 'Dados não encontrados. Verifique CPF, email ou celular.' }, { status: 401 })
    }

    if (socio.bloqueio === 'S') {
      return NextResponse.json({
        error: `Acesso bloqueado. ${socio.motivoBloqueio ? `Motivo: ${socio.motivoBloqueio}` : 'Entre em contato com a ASPMA.'}`,
      }, { status: 403 })
    }

    // Verificar senha — suporta bcrypt e texto puro (legado)
    if (!socio.senha) {
      return NextResponse.json({
        error: 'Você ainda não definiu uma senha. Use "Primeiro Acesso" para cadastrar.',
        semSenha: true,
      }, { status: 401 })
    }

    let senhaOk = false
    const isBcrypt = socio.senha.startsWith('$2')
    if (isBcrypt) {
      senhaOk = await bcrypt.compare(senha, socio.senha)
    } else {
      // senha legada em texto puro
      senhaOk = socio.senha === senha
    }

    if (!senhaOk) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })
    }

    // Gerar JWT
    const token = await new SignJWT({
      socioId: socio.id,
      nome: socio.nome,
      matricula: socio.matricula,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(JWT_SECRET)

    const response = NextResponse.json({ ok: true, nome: socio.nome.split(' ')[0] })
    response.cookies.set('portal_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8h
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[portal/auth]', error)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('portal_token')
  return response
}

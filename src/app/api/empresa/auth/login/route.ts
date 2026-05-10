import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { createAuditLog, getRequestInfo } from '@/lib/audit-log'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

/**
 * POST /api/empresa/auth/login
 * Autentica uma empresa (consignatária) usando email + senha (plain text — mesmo padrão do convenio).
 * Retorna cookie httpOnly `empresa_session` válido por 8h.
 */
export async function POST(request: NextRequest) {
  try {
    const { login, senha } = await request.json()
    const requestInfo = getRequestInfo(request)

    if (!login || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Busca empresa por email (case-insensitive)
    const empresa = await prisma.empresa.findFirst({
      where: { email: { equals: login, mode: 'insensitive' } },
    })

    if (!empresa) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      )
    }

    if (!empresa.ativo) {
      return NextResponse.json({ error: 'empresa_inativa' }, { status: 403 })
    }

    // Empresa sem senha cadastrada → precisa redefinir via "esqueci minha senha"
    if (!empresa.senha) {
      return NextResponse.json(
        { error: 'senha_nao_cadastrada' },
        { status: 401 }
      )
    }

    if (empresa.senha !== senha) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      )
    }

    // Gera token JWT
    const token = await new SignJWT({
      empresaId: empresa.id,
      email: empresa.email || '',
      nome: empresa.nome,
      tipo: empresa.tipo || null,
      diaCorte: empresa.diaCorte || 9,
      senhaChangedAt: empresa.senhaChangedAt?.toISOString() || null,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(JWT_SECRET)

    const cookieStore = await cookies()
    cookieStore.set('empresa_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    await createAuditLog({
      userId: 'empresa-' + empresa.id,
      userName: empresa.email || empresa.nome,
      userRole: 'EMPRESA',
      action: 'LOGIN',
      module: 'auth',
      entityId: empresa.id.toString(),
      entityName: empresa.nome,
      description: `Login realizado pela consignatária ${empresa.nome}`,
      metadata: {
        empresaId: empresa.id,
        nome: empresa.nome,
        email: empresa.email,
      },
      ...requestInfo,
    })

    return NextResponse.json({
      success: true,
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        email: empresa.email,
      },
    })
  } catch (error) {
    console.error('Erro no login da empresa:', error)
    return NextResponse.json({ error: 'Erro ao processar login' }, { status: 500 })
  }
}

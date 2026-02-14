import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { createAuditLog, getRequestInfo } from '@/lib/audit-log'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const { usuario, senha } = await request.json()
    const requestInfo = getRequestInfo(request)

    if (!usuario || !senha) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Busca convênio pelo usuário
    const convenio = await prisma.convenio.findFirst({
      where: {
        usuario: usuario,
        ativo: true,
      },
    })

    if (!convenio) {
      return NextResponse.json(
        { error: 'Usuário ou senha inválidos' },
        { status: 401 }
      )
    }

    // Verifica senha (comparação direta - no futuro pode usar hash)
    if (convenio.senha !== senha) {
      return NextResponse.json(
        { error: 'Usuário ou senha inválidos' },
        { status: 401 }
      )
    }

    // Gera token JWT
    const token = await new SignJWT({
      convenioId: convenio.id,
      usuario: convenio.usuario,
      razaoSocial: convenio.razao_soc,
      fantasia: convenio.fantasia,
      tipo: convenio.tipo || null,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(JWT_SECRET)

    // Define cookie de sessão
    const cookieStore = await cookies()
    cookieStore.set('convenio_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 horas
      path: '/',
    })

    // Registra login no audit log
    await createAuditLog({
      userId: 'convenio-' + convenio.id,
      userName: convenio.usuario || convenio.razao_soc,
      userRole: 'CONVENIO',
      action: 'LOGIN',
      module: 'auth',
      entityId: convenio.id.toString(),
      entityName: convenio.fantasia || convenio.razao_soc,
      description: `Login realizado pelo convênio ${convenio.fantasia || convenio.razao_soc}`,
      metadata: {
        convenioId: convenio.id,
        razaoSocial: convenio.razao_soc,
        fantasia: convenio.fantasia,
        usuario: convenio.usuario,
      },
      ...requestInfo
    })

    return NextResponse.json({
      success: true,
      convenio: {
        id: convenio.id,
        razaoSocial: convenio.razao_soc,
        fantasia: convenio.fantasia,
        email: convenio.email,
      },
    })
  } catch (error) {
    console.error('Erro no login do conveniado:', error)
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    )
  }
}

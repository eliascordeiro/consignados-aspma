import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const { sessionToken, codigo } = await request.json()

    if (!sessionToken || !codigo) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }

    // Verificar e decodificar o session token
    let payload: { socioId: string; otp: string; type: string }
    try {
      const result = await jwtVerify(sessionToken, JWT_SECRET)
      payload = result.payload as typeof payload
    } catch {
      return NextResponse.json({ error: 'Código expirado. Solicite um novo.' }, { status: 401 })
    }

    if (payload.type !== 'otp_request') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    if (payload.otp !== codigo.trim()) {
      return NextResponse.json({ error: 'Código incorreto. Verifique e tente novamente.' }, { status: 401 })
    }

    // Gerar token confirmado — curto prazo, apenas para salvar a senha
    const confirmedToken = await new SignJWT({ socioId: payload.socioId, type: 'otp_confirmed' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(JWT_SECRET)

    return NextResponse.json({ confirmedToken })
  } catch (err) {
    console.error('[verificar-otp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

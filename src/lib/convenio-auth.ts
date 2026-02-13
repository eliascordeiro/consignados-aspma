import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export interface ConvenioSession {
  convenioId: number
  usuario: string
  razaoSocial: string
  fantasia: string | null
}

export async function getConvenioSession(
  request?: NextRequest
): Promise<ConvenioSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('convenio_session')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)

    return {
      convenioId: payload.convenioId as number,
      usuario: payload.usuario as string,
      razaoSocial: payload.razaoSocial as string,
      fantasia: payload.fantasia as string | null,
    }
  } catch (error) {
    console.error('Erro ao verificar sessão do conveniado:', error)
    return null
  }
}

export async function requireConvenioSession(
  request: NextRequest
): Promise<ConvenioSession> {
  const session = await getConvenioSession(request)

  if (!session) {
    throw new Error('Sessão não encontrada')
  }

  return session
}

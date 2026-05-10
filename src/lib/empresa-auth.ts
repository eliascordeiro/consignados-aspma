import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export interface EmpresaSession {
  empresaId: number
  email: string
  nome: string
  tipo: string | null
  diaCorte: number
  senhaChangedAt: string | null
}

export async function getEmpresaSession(
  _request?: NextRequest
): Promise<EmpresaSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('empresa_session')?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, JWT_SECRET)

    return {
      empresaId: payload.empresaId as number,
      email: payload.email as string,
      nome: payload.nome as string,
      tipo: (payload.tipo as string | null) || null,
      diaCorte: (payload.diaCorte as number) || 9,
      senhaChangedAt: (payload.senhaChangedAt as string | null) || null,
    }
  } catch (error) {
    console.error('❌ [EMPRESA AUTH] Erro ao verificar sessão:', error)
    return null
  }
}

export async function requireEmpresaSession(
  request: NextRequest
): Promise<EmpresaSession> {
  const session = await getEmpresaSession(request)
  if (!session) throw new Error('Sessão não encontrada')
  return session
}

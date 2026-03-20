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
  tipo: string | null
  senhaChangedAt: string | null
}

export async function getConvenioSession(
  request?: NextRequest
): Promise<ConvenioSession | null> {
  try {
    console.log('🔑 [CONVENIO AUTH] getConvenioSession chamado')
    const cookieStore = await cookies()
    const token = cookieStore.get('convenio_session')?.value

    console.log('🔑 [CONVENIO AUTH] Cookie encontrado:', !!token)
    
    if (!token) {
      console.log('🔑 [CONVENIO AUTH] Nenhum token encontrado')
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    console.log('🔑 [CONVENIO AUTH] Token válido, convenioId:', payload.convenioId)

    return {
      convenioId: payload.convenioId as number,
      usuario: payload.usuario as string,
      razaoSocial: payload.razaoSocial as string,
      fantasia: payload.fantasia as string | null,
      tipo: (payload.tipo as string | null) || null,
      senhaChangedAt: (payload.senhaChangedAt as string | null) || null,
    }
  } catch (error) {
    console.error('❌ [CONVENIO AUTH] Erro ao verificar sessão:', error)
    return null
  }
}

export async function requireConvenioSession(
  request: NextRequest
): Promise<ConvenioSession> {
  console.log('🔑 [CONVENIO AUTH] requireConvenioSession chamado')
  const session = await getConvenioSession(request)

  if (!session) {
    console.error('❌ [CONVENIO AUTH] Sessão não encontrada - lançando erro')
    throw new Error('Sessão não encontrada')
  }

  console.log('✅ [CONVENIO AUTH] Sessão válida retornada')
  return session
}

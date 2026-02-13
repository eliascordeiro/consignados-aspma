import { NextResponse } from 'next/server'
import { getConvenioSession } from '@/lib/convenio-auth'

// GET /api/convenio/check — verifica se o usuário logado é conveniado
export async function GET() {
  try {
    const session = await getConvenioSession()

    console.log('🔍 Convenio check - session:', session ? 'found' : 'null')

    if (session) {
      return NextResponse.json({
        isConvenio: true,
        fantasia: session.fantasia,
        razaoSocial: session.razaoSocial,
        convenioId: session.convenioId,
      })
    }

    return NextResponse.json({ isConvenio: false }, { status: 200 })
  } catch (error) {
    console.error('Erro no convenio check:', error)
    return NextResponse.json({ isConvenio: false }, { status: 200 })
  }
}

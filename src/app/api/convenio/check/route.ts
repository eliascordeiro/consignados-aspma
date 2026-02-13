import { NextResponse } from 'next/server'
import { getConvenioSession } from '@/lib/convenio-auth'

// GET /api/convenio/check — verifica se o usuário logado é conveniado
export async function GET() {
  try {
    const session = await getConvenioSession()

    if (session) {
      return NextResponse.json({
        isConvenio: true,
        fantasia: session.fantasia,
        razaoSocial: session.razaoSocial,
      })
    }

    return NextResponse.json({ isConvenio: false }, { status: 200 })
  } catch {
    return NextResponse.json({ isConvenio: false }, { status: 200 })
  }
}

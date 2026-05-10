import { NextResponse } from 'next/server'
import { getEmpresaSession } from '@/lib/empresa-auth'
import { auth } from '@/lib/auth'

// GET /api/empresa/check — verifica se há sessão válida de empresa
export async function GET() {
  try {
    const nextAuthSession = await auth()
    const role = (nextAuthSession?.user as any)?.role
    if (role === 'ADMIN' || role === 'MANAGER') {
      return NextResponse.json({ isEmpresa: false }, { status: 200 })
    }

    const session = await getEmpresaSession()
    if (session) {
      return NextResponse.json({
        isEmpresa: true,
        empresaId: session.empresaId,
        nome: session.nome,
        email: session.email,
      })
    }
    return NextResponse.json({ isEmpresa: false }, { status: 200 })
  } catch (error) {
    console.error('Erro no empresa check:', error)
    return NextResponse.json({ isEmpresa: false }, { status: 200 })
  }
}

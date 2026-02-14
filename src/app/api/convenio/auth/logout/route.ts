import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getConvenioSession } from '@/lib/convenio-auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getRequestInfo } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  try {
    const requestInfo = getRequestInfo(request)
    
    // Tenta obter a sessão antes de deletar
    let convenio = null
    try {
      const session = await getConvenioSession()
      if (session) {
        convenio = await prisma.convenio.findUnique({
          where: { id: session.convenioId },
          select: { id: true, razao_soc: true, fantasia: true, usuario: true }
        })
      }
    } catch (e) {
      // Sessão já expirada ou inválida
    }

    const cookieStore = await cookies()
    cookieStore.delete('convenio_session')

    // Registra logout no audit log
    if (convenio) {
      await createAuditLog({
        userId: 'convenio-' + convenio.id,
        userName: convenio.usuario || convenio.razao_soc,
        userRole: 'CONVENIO',
        action: 'LOGOUT',
        module: 'auth',
        entityId: convenio.id.toString(),
        entityName: convenio.fantasia || convenio.razao_soc,
        description: `Logout realizado pelo convênio ${convenio.fantasia || convenio.razao_soc}`,
        metadata: {
          convenioId: convenio.id,
          razaoSocial: convenio.razao_soc,
          fantasia: convenio.fantasia,
        },
        ...requestInfo
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro no logout:', error)
    return NextResponse.json(
      { error: 'Erro ao processar logout' },
      { status: 500 }
    )
  }
}

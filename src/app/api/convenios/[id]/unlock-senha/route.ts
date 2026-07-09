import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog, getRequestInfo } from "@/lib/audit-log"

// Desbloqueia o acesso do convênio quando a senha ultrapassou 60 dias sem renovação
// (hard lock). Reinicia o contador definindo senhaChangedAt para agora, permitindo
// que o convênio faça login e defina uma nova senha normalmente.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!hasPermission(session.user, 'convenios.edit')) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { id: paramId } = await params
    const id = parseInt(paramId)
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const existing = await db.convenio.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Convênio não encontrado" }, { status: 404 })
    }

    const now = new Date()
    const convenio = await db.convenio.update({
      where: { id },
      data: { senhaChangedAt: now },
    })

    const { ipAddress, userAgent } = getRequestInfo(req)
    await createAuditLog({
      userId: session.user.id,
      userName: (session.user as any).name || session.user.email || session.user.id,
      userRole: (session.user as any).role || 'UNKNOWN',
      action: 'UPDATE',
      module: 'convenios',
      entityId: convenio.id.toString(),
      entityName: convenio.fantasia || convenio.razao_soc,
      description: `Acesso do convênio desbloqueado: ${convenio.fantasia || convenio.razao_soc}`,
      metadata: { convenioId: convenio.id, razaoSocial: convenio.razao_soc },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ ok: true, senhaChangedAt: now.toISOString() })
  } catch (error) {
    console.error("Erro ao desbloquear convênio:", error)
    return NextResponse.json({ error: "Erro ao desbloquear convênio" }, { status: 500 })
  }
}

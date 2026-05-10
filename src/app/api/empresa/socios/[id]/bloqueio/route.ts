import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// POST /api/empresa/socios/[id]/bloqueio
// Body: { bloquear: boolean, motivo?: string }
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const socio = await prisma.socio.findUnique({
    where: { id },
    select: { id: true, empresaId: true, bloqueio: true },
  })
  if (!socio || socio.empresaId !== session.empresaId) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const body = await request.json()
  const bloquear = !!body.bloquear
  const motivo = (body.motivo || '').toString().trim()

  if (bloquear && !motivo) {
    return NextResponse.json({ error: 'Informe o motivo do bloqueio' }, { status: 400 })
  }

  const updated = await prisma.socio.update({
    where: { id },
    data: bloquear
      ? { bloqueio: 'S', motivoBloqueio: motivo }
      : { bloqueio: null, motivoBloqueio: null },
    select: { id: true, nome: true, bloqueio: true, motivoBloqueio: true },
  })

  return NextResponse.json({ success: true, socio: updated })
}

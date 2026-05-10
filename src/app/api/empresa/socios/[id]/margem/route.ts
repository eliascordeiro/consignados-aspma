import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// POST /api/empresa/socios/[id]/margem
// Body: { limite?: number, margemConsig?: number, motivo: string, observacao?: string }
// Cria entrada em margem_historicos vinculada ao userId dono da Empresa (manager).
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

  const body = await request.json()
  const limiteRaw = body.limite
  const margemRaw = body.margemConsig
  const motivo = (body.motivo || '').toString().trim()
  const observacao = (body.observacao || '').toString().trim() || null

  if (!motivo) {
    return NextResponse.json({ error: 'Informe o motivo da alteração' }, { status: 400 })
  }
  if (limiteRaw === undefined && margemRaw === undefined) {
    return NextResponse.json({ error: 'Informe limite e/ou margem' }, { status: 400 })
  }

  const socioAtual = await prisma.socio.findUnique({
    where: { id },
    select: { id: true, empresaId: true, nome: true, limite: true, margemConsig: true },
  })
  if (!socioAtual || socioAtual.empresaId !== session.empresaId) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: session.empresaId },
    select: { userId: true },
  })
  if (!empresa?.userId) {
    return NextResponse.json(
      { error: 'Empresa sem manager associado, não é possível registrar histórico.' },
      { status: 400 }
    )
  }

  const updateData: any = {}
  if (limiteRaw !== undefined) updateData.limite = parseFloat(String(limiteRaw)) || 0
  if (margemRaw !== undefined) updateData.margemConsig = parseFloat(String(margemRaw)) || 0

  const observacaoFinal =
    `[Portal Consignatária - ${session.nome}]` + (observacao ? ` ${observacao}` : '')

  const [socioAtualizado] = await prisma.$transaction([
    prisma.socio.update({
      where: { id },
      data: updateData,
      select: { id: true, nome: true, limite: true, margemConsig: true },
    }),
    prisma.margemHistorico.create({
      data: {
        socioId: id,
        userId: empresa.userId,
        limiteAnterior: socioAtual.limite,
        limiteNovo:
          limiteRaw !== undefined ? parseFloat(String(limiteRaw)) || 0 : socioAtual.limite,
        margemAnterior: socioAtual.margemConsig,
        margemNova:
          margemRaw !== undefined ? parseFloat(String(margemRaw)) || 0 : socioAtual.margemConsig,
        motivo,
        observacao: observacaoFinal,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    socio: {
      ...socioAtualizado,
      limite: socioAtualizado.limite != null ? Number(socioAtualizado.limite) : null,
      margemConsig:
        socioAtualizado.margemConsig != null ? Number(socioAtualizado.margemConsig) : null,
    },
  })
}

// GET /api/empresa/socios/[id]/margem — histórico
export async function GET(
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
    select: { empresaId: true },
  })
  if (!socio || socio.empresaId !== session.empresaId) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const historicos = await prisma.margemHistorico.findMany({
    where: { socioId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { usuario: { select: { name: true } } },
  })

  return NextResponse.json(
    historicos.map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      limiteAnterior: h.limiteAnterior != null ? Number(h.limiteAnterior) : null,
      limiteNovo: h.limiteNovo != null ? Number(h.limiteNovo) : null,
      margemAnterior: h.margemAnterior != null ? Number(h.margemAnterior) : null,
      margemNova: h.margemNova != null ? Number(h.margemNova) : null,
      motivo: h.motivo,
      observacao: h.observacao,
      usuario: h.usuario?.name || null,
    }))
  )
}

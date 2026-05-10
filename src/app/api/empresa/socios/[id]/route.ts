import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

async function authorize(request: NextRequest, socioId: string) {
  const session = await requireEmpresaSession(request)
  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: { id: true, empresaId: true },
  })
  if (!socio || socio.empresaId !== session.empresaId) {
    return { error: NextResponse.json({ error: 'Não encontrado' }, { status: 404 }) }
  }
  return { session, socio }
}

// GET /api/empresa/socios/[id]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  let auth
  try {
    auth = await authorize(request, id)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if ('error' in auth) return auth.error

  const socio = await prisma.socio.findUnique({
    where: { id },
    include: {
      empresa: { select: { id: true, nome: true } },
      _count: { select: { vendas: true, margemHistoricos: true } },
    },
  })
  if (!socio) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({
    ...socio,
    limite: socio.limite != null ? Number(socio.limite) : null,
    margemConsig: socio.margemConsig != null ? Number(socio.margemConsig) : null,
    gratificacao: socio.gratificacao != null ? Number(socio.gratificacao) : null,
    devolucao: socio.devolucao != null ? Number(socio.devolucao) : null,
  })
}

// PATCH /api/empresa/socios/[id] — atualizar dados cadastrais
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  let auth
  try {
    auth = await authorize(request, id)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if ('error' in auth) return auth.error

  const body = await request.json()
  // Campos editáveis pela empresa (NÃO inclui limite/margem — vão por endpoint próprio)
  const allowed: Record<string, any> = {}
  const fields = [
    'nome', 'rg', 'matricula', 'funcao', 'lotacao',
    'endereco', 'bairro', 'cep', 'cidade', 'uf',
    'telefone', 'celular', 'email', 'sexo', 'estadoCivil',
    'agencia', 'conta', 'banco', 'dataAdmissao', 'dataNascimento',
  ]
  for (const f of fields) {
    if (f in body) {
      if (f === 'dataAdmissao' || f === 'dataNascimento') {
        allowed[f] = body[f] ? new Date(body[f]) : null
      } else if (f === 'cep' && body[f]) {
        allowed[f] = String(body[f]).replace(/\D/g, '')
      } else {
        allowed[f] = body[f] || null
      }
    }
  }

  const socio = await prisma.socio.update({
    where: { id },
    data: allowed,
    select: { id: true, nome: true },
  })

  return NextResponse.json({ success: true, socio })
}

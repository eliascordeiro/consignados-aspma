import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// GET /api/empresa/socios — lista paginada com filtros
//   query params: q, status (ativos|bloqueados|inativos|todos), page, pageSize
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const q = (searchParams.get('q') || '').trim()
  const status = searchParams.get('status') || 'todos'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(10, parseInt(searchParams.get('pageSize') || '50')))

  const where: any = { empresaId: session.empresaId }
  if (q) {
    where.OR = [
      { nome: { contains: q, mode: 'insensitive' } },
      { cpf: { contains: q } },
      { matricula: { contains: q } },
    ]
  }
  if (status === 'ativos') {
    where.ativo = true
    where.bloqueio = null
  } else if (status === 'bloqueados') {
    where.bloqueio = { not: null }
  } else if (status === 'inativos') {
    where.ativo = false
  }

  const [total, items] = await Promise.all([
    prisma.socio.count({ where }),
    prisma.socio.findMany({
      where,
      select: {
        id: true,
        nome: true,
        cpf: true,
        matricula: true,
        funcao: true,
        lotacao: true,
        celular: true,
        email: true,
        limite: true,
        margemConsig: true,
        bloqueio: true,
        motivoBloqueio: true,
        ativo: true,
        createdAt: true,
      },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    items: items.map((s) => ({
      ...s,
      limite: s.limite != null ? Number(s.limite) : null,
      margemConsig: s.margemConsig != null ? Number(s.margemConsig) : null,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  })
}

// POST /api/empresa/socios — cadastrar novo funcionário
export async function POST(request: NextRequest) {
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const {
    nome,
    cpf,
    rg,
    matricula,
    funcao,
    lotacao,
    endereco,
    bairro,
    cep,
    cidade,
    uf,
    telefone,
    celular,
    email,
    dataAdmissao,
    dataNascimento,
    sexo,
    estadoCivil,
    limite,
    margemConsig,
    agencia,
    conta,
    banco,
  } = body

  if (!nome || !nome.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  // Verificar duplicidade de CPF dentro da mesma empresa
  if (cpf) {
    const cpfClean = String(cpf).replace(/\D/g, '')
    const existing = await prisma.socio.findFirst({
      where: { empresaId: session.empresaId, cpf: cpfClean },
      select: { id: true, nome: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Já existe um funcionário com este CPF: ${existing.nome}` },
        { status: 400 }
      )
    }
  }

  const socio = await prisma.socio.create({
    data: {
      empresaId: session.empresaId,
      nome: nome.trim(),
      cpf: cpf ? String(cpf).replace(/\D/g, '') : null,
      rg: rg || null,
      matricula: matricula || null,
      funcao: funcao || null,
      lotacao: lotacao || null,
      endereco: endereco || null,
      bairro: bairro || null,
      cep: cep ? String(cep).replace(/\D/g, '') : null,
      cidade: cidade || null,
      uf: uf || null,
      telefone: telefone || null,
      celular: celular || null,
      email: email || null,
      dataAdmissao: dataAdmissao ? new Date(dataAdmissao) : null,
      dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
      dataCadastro: new Date(),
      sexo: sexo || null,
      estadoCivil: estadoCivil || null,
      limite: limite ? Number(limite) : null,
      margemConsig: margemConsig ? Number(margemConsig) : null,
      agencia: agencia || null,
      conta: conta || null,
      banco: banco || null,
      ativo: true,
    },
    select: { id: true, nome: true },
  })

  return NextResponse.json({ success: true, socio })
}

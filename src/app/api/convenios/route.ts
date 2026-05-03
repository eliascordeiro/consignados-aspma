import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getDataUserId } from "@/lib/get-data-user-id"
import { hasPermission } from "@/lib/permissions"
import { randomBytes } from "crypto"

// Função helper para converter o campo libera em tipo
function getTipoFromLibera(libera: string | null | undefined): string {
  if (libera === 'X') return 'BANCO'
  if (libera === 'T') return 'TESTE'
  return 'COMERCIO' // em branco ou qualquer outro valor
}

const convenioSchema = z.object({
  codigo: z.string().optional(),
  razao_soc: z.string().min(1, "Razão Social é obrigatória"),
  fantasia: z.string().optional(),
  nome: z.string().optional(),
  cnpj: z.string().optional(),
  cgc: z.string().optional(),
  tipo: z.string().optional(),
  libera: z.string().optional(),
  desconto: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? null : num
  }),
  parcelas: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseInt(val) : val
    return isNaN(num) ? null : num
  }),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  uf: z.string().optional(),
  telefone: z.string().optional(),
  fone: z.string().optional(),
  fax: z.string().optional(),
  contato: z.string().optional(),
  email: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  ativo: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Permitir acesso se:
    // 1. Tem convenios.view (acesso ao módulo convênios/locais)
    // 2. Tem vendas.* (precisa ver convênios para criar/editar vendas)
    const hasConveniosAccess = hasPermission(session.user, 'convenios.view')
    const hasVendasAccess = 
      hasPermission(session.user, 'vendas.view') ||
      hasPermission(session.user, 'vendas.create') ||
      hasPermission(session.user, 'vendas.edit')
    
    if (!hasConveniosAccess && !hasVendasAccess) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Buscar userId correto (herda dados do MANAGER se for subordinado)
    const dataUserId = await getDataUserId(session as any)

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Detectar se a busca é por status
    const searchLower = search.toLowerCase().trim()
    let statusFilter: boolean | null = null
    
    if (searchLower === 'ativo' || searchLower === 'ativos') {
      statusFilter = true
    } else if (searchLower === 'inativo' || searchLower === 'inativos') {
      statusFilter = false
    }

    // ADMIN e MANAGER veem TODOS os convênios (não filtra por userId)
    // USER vê os convênios do seu userId OU convênios globais (userId = null)
    // Inclui também convênios cujo userId pertence a sub-usuários criados pelo mesmo manager
    // (necessário porque ao criar convênio com email, um novo user é criado com createdById=managerUserId)
    let userFilter: any
    if (session.user?.role === 'ADMIN' || session.user?.role === 'MANAGER') {
      userFilter = {}
    } else {
      const subUsers = await db.users.findMany({
        where: { createdById: dataUserId },
        select: { id: true },
      })
      const allUserIds = [dataUserId, ...subUsers.map((u) => u.id)]
      userFilter = { OR: [{ userId: { in: allUserIds } }, { userId: null }] }
    }

    const searchFilter = statusFilter !== null
      ? { ativo: statusFilter }
      : search
        ? {
            OR: [
              { codigo: { contains: search, mode: "insensitive" as const } },
              { razao_soc: { contains: search, mode: "insensitive" as const } },
              { fantasia: { contains: search, mode: "insensitive" as const } },
              { nome: { contains: search, mode: "insensitive" as const } },
              { cgc: { contains: search, mode: "insensitive" as const } },
              { cnpj: { contains: search, mode: "insensitive" as const } },
              { cidade: { contains: search, mode: "insensitive" as const } },
            ]
          }
        : {}

    const isFullAccess = session.user?.role === 'ADMIN' || session.user?.role === 'MANAGER'
    const where: any = isFullAccess
      ? searchFilter
      : { AND: [userFilter, ...(Object.keys(searchFilter).length ? [searchFilter] : [])] }

    // Quando busca é numérica, busca mais registros e reordena: código exato → começa com → resto
    const isNumericSearch = /^\d+$/.test(search.trim())

    const [conveniosRaw, total] = await Promise.all([
      db.convenio.findMany({
        where,
        orderBy: { razao_soc: "asc" },
        take: isNumericSearch ? limit * 4 : limit,
        skip: isNumericSearch ? 0 : skip,
      }),
      db.convenio.count({ where })
    ])

    let convenios = conveniosRaw
    if (isNumericSearch) {
      const termo = search.trim()
      const exact = conveniosRaw.filter(c => c.codigo === termo)
      const starts = conveniosRaw.filter(c => c.codigo !== termo && c.codigo?.startsWith(termo))
      const rest   = conveniosRaw.filter(c => c.codigo !== termo && !c.codigo?.startsWith(termo))

      // Ordenar exact e starts numericamente pelo código
      const numSort = (a: any, b: any) => {
        const na = parseInt(a.codigo || '0', 10)
        const nb = parseInt(b.codigo || '0', 10)
        return na - nb
      }
      exact.sort(numSort)
      starts.sort(numSort)

      convenios = [...exact, ...starts, ...rest].slice(skip, skip + limit)
    }

    return NextResponse.json({
      data: convenios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Erro ao buscar convênios:", error)
    return NextResponse.json(
      { error: "Erro ao buscar convênios" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!hasPermission(session.user, 'convenios.create')) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const body = await req.json()
    const data = convenioSchema.parse(body)

    // Verificar se CNPJ já existe (se fornecido)
    if (data.cnpj) {
      const existing = await db.convenio.findFirst({
        where: {
          cnpj: data.cnpj,
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: "CNPJ já cadastrado" },
          { status: 400 }
        )
      }
    }

    // Gerar campos derivados
    const managerUserId = await getDataUserId(session as any)

    // Se foi fornecido email, criar user para o convênio poder fazer login
    // O user é criado sem senha válida — o convênio deve usar "Criar/Redefinir Senha"
    // Se não houver email, o convênio fica vinculado ao manager (apenas para fins de visibilidade do dono)
    let convenioUserId: string = managerUserId
    if (data.email) {
      const emailLower = data.email.trim().toLowerCase()
      const nomeUser = (data.fantasia || data.razao_soc || emailLower).trim()

      // Verifica se já existe user com esse email
      const existingUser = await db.users.findUnique({ where: { email: emailLower } })

      if (existingUser) {
        // NUNCA reusar ADMIN/MANAGER como user de convênio (poderia sobrescrever email/senha do gestor)
        if (existingUser.role !== 'USER') {
          return NextResponse.json(
            { error: 'Este email pertence a um usuário administrador. Escolha um email diferente.' },
            { status: 400 }
          )
        }
        // Reutiliza o user USER existente (pode ser de cadastro anterior)
        convenioUserId = existingUser.id
      } else {
        // Cria user sem senha válida — senha bloqueada com sentinel
        const newUser = await db.users.create({
          data: {
            email: emailLower,
            name: nomeUser,
            password: `!${randomBytes(32).toString('hex')}`, // sentinel: nunca passa no bcrypt.compare
            role: 'USER',
            active: true,
            permissions: [],
            createdById: managerUserId,
          },
        })
        convenioUserId = newUser.id
        console.log(`[convenios] User criado para convênio: ${emailLower} (id: ${newUser.id})`)
      }
    }

    const dataToSave = {
      ...data,
      nome: data.razao_soc || data.fantasia || 'Sem nome',
      cgc: data.cnpj || data.cgc,
      uf: data.estado || data.uf,
      fone: data.telefone || data.fone,
      tipo: getTipoFromLibera(data.libera),
      userId: convenioUserId,
    }

    const convenio = await db.convenio.create({
      data: dataToSave,
    })

    return NextResponse.json(convenio, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Erro ao criar convênio:", error)
    return NextResponse.json(
      { error: "Erro ao criar convênio" },
      { status: 500 }
    )
  }
}

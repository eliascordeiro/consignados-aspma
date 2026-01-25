import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

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
  desconto: z.union([z.string(), z.number()]).optional().transform(val => {
    if (!val) return null
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? null : num
  }),
  parcelas: z.union([z.string(), z.number()]).optional().transform(val => {
    if (!val) return null
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
  email: z.string().email("Email inválido").optional().or(z.literal("")),
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

    const where = {
      ...(statusFilter !== null 
        ? { ativo: statusFilter }
        : search && {
            OR: [
              { codigo: { contains: search, mode: "insensitive" as const } },
              { razao_soc: { contains: search, mode: "insensitive" as const } },
              { fantasia: { contains: search, mode: "insensitive" as const } },
              { nome: { contains: search, mode: "insensitive" as const } },
              { cgc: { contains: search, mode: "insensitive" as const } },
              { cnpj: { contains: search, mode: "insensitive" as const } },
              { cidade: { contains: search, mode: "insensitive" as const } },
            ],
          }
      ),
    }

    const [convenios, total] = await Promise.all([
      db.convenio.findMany({
        where,
        orderBy: { razao_soc: "asc" },
        take: limit,
        skip,
      }),
      db.convenio.count({ where })
    ])

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
    const dataToSave = {
      ...data,
      nome: data.razao_soc || data.fantasia || 'Sem nome',
      cgc: data.cnpj || data.cgc,
      uf: data.estado || data.uf,
      fone: data.telefone || data.fone,
      tipo: getTipoFromLibera(data.libera),
      userId: session.user.role === "MANAGER" || session.user.role === "ADMIN" ? null : session.user.id,
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

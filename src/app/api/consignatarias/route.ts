import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { createAuditLog, getRequestInfo } from "@/lib/audit-log"

const empresaSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  cnpj: z.string().optional(),
  tipo: z.enum(["PUBLICO", "PRIVADO"]),
  telefone: z.string().optional(),
  email: z.string().email("Email inválido").optional(),
  contato: z.string().optional(),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  ativo: z.boolean().default(true),
})

// GET - Listar consignatárias do usuário
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // MANAGER e ADMIN podem ver todas as empresas
    // Usuários subordinados veem as empresas do MANAGER que os criou
    // Outros roles veem apenas as suas próprias empresas
    let where: any = {}
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      const targetUserId = session.user.id
      where.userId = targetUserId
    }

    // Detectar se a busca é por status
    const searchLower = search.toLowerCase().trim()
    let statusFilter: boolean | null = null
    
    if (searchLower === 'ativo' || searchLower === 'ativos') {
      statusFilter = true
    } else if (searchLower === 'inativo' || searchLower === 'inativos') {
      statusFilter = false
    }

    // Se for busca por status, aplicar filtro
    if (statusFilter !== null) {
      where.ativo = statusFilter
    } else if (search) {
      // Senão, buscar por nome ou CNPJ
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { cnpj: { contains: search, mode: "insensitive" } }
      ]
    }

    const [empresas, total] = await Promise.all([
      prisma.empresa.findMany({
        where,
        orderBy: {
          nome: "asc",
        },
        take: limit,
        skip,
      }),
      prisma.empresa.count({ where })
    ])

    return NextResponse.json({
      data: empresas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Erro ao listar consignatárias:", error)
    return NextResponse.json(
      { error: "Erro ao listar consignatárias" },
      { status: 500 }
    )
  }
}

// POST - Criar consignatária
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = empresaSchema.parse(body)

    // Verificar se CNPJ já existe
    if (validatedData.cnpj) {
      const existingEmpresa = await prisma.empresa.findFirst({
        where: { cnpj: validatedData.cnpj },
      })

      if (existingEmpresa) {
        return NextResponse.json(
          { error: "CNPJ já cadastrado" },
          { status: 400 }
        )
      }
    }

    const empresa = await prisma.empresa.create({
      data: {
        ...validatedData,
        userId: session.user.id,
      },
    })

    // Registrar log de auditoria
    const { ipAddress, userAgent } = getRequestInfo(request)
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "CREATE",
      module: "consignatarias",
      entityId: empresa.id.toString(),
      entityName: empresa.nome,
      description: `Consignatária "${empresa.nome}" criada`,
      metadata: {
        cnpj: empresa.cnpj,
        tipo: empresa.tipo,
      },
      ipAddress,
      userAgent,
    })

    return NextResponse.json(empresa, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    
    console.error("Erro ao criar consignatária:", error)
    return NextResponse.json(
      { error: "Erro ao criar consignatária" },
      { status: 500 }
    )
  }
}

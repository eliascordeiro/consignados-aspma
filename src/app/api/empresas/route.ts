import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDataUserId } from "@/lib/get-data-user-id"
import { hasPermission } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Permitir acesso se:
    // 1. Tem consignatarias.view (acesso completo ao módulo)
    // 2. Tem funcionarios.* (precisa ver empresas para criar/editar funcionários)
    const hasConsignatariasAccess = hasPermission(session.user, 'consignatarias.view')
    const hasFuncionariosAccess = 
      hasPermission(session.user, 'funcionarios.view') ||
      hasPermission(session.user, 'funcionarios.create') ||
      hasPermission(session.user, 'funcionarios.edit')
    
    if (!hasConsignatariasAccess && !hasFuncionariosAccess) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Buscar userId correto (herda dados do MANAGER se for subordinado)
    const dataUserId = await getDataUserId(session as any)

    const where: any = { userId: dataUserId }
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" as const } },
        { cnpj: { contains: search, mode: "insensitive" as const } },
      ]
    }

    const [empresas, total] = await Promise.all([
      db.empresa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          cnpj: true,
          tipo: true,
          ativo: true,
        },
      }),
      db.empresa.count({ where }),
    ])

    return NextResponse.json({
      data: empresas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error("[GET /api/empresas]", error)
    return NextResponse.json(
      { error: "Erro ao buscar empresas: " + error.message },
      { status: 500 }
    )
  }
}

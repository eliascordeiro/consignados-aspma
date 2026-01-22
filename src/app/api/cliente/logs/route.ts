import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/config/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Apenas MANAGER e ADMIN podem ver logs
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Verificar permissão específica
    const userPermissions = (session.user as any).permissions || []
    if (!hasPermission(userPermissions, "logs.view")) {
      return NextResponse.json({ error: "Sem permissão para visualizar logs" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const module = searchParams.get("module")
    const action = searchParams.get("action")
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Construir filtros
    const where: any = {}

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { entityName: { contains: search, mode: "insensitive" } },
      ]
    }

    if (module) {
      where.module = module
    }

    if (action) {
      where.action = action
    }

    if (userId) {
      where.userId = userId
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip,
        select: {
          id: true,
          userId: true,
          userName: true,
          userRole: true,
          action: true,
          module: true,
          entityId: true,
          entityName: true,
          description: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        }
      }),
      prisma.auditLog.count({ where })
    ])

    return NextResponse.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erro ao buscar logs:", error)
    return NextResponse.json(
      { error: "Erro ao buscar logs" },
      { status: 500 }
    )
  }
}

// POST - Criar log de auditoria (uso interno da API)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const data = await request.json()

    const log = await prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        userRole: data.userRole,
        action: data.action,
        module: data.module,
        entityId: data.entityId,
        entityName: data.entityName,
        description: data.description,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error: any) {
    console.error("Erro ao criar log:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao criar log" },
      { status: 500 }
    )
  }
}

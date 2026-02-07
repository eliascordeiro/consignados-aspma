import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

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

    const where = search
      ? {
          OR: [
            { nome: { contains: search, mode: "insensitive" as const } },
            { cnpj: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}

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

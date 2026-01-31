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
            { matricula: { contains: search, mode: "insensitive" as const } },
            { nome: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}

    const [socios, total] = await Promise.all([
      db.socio.findMany({
        where,
        select: {
          id: true,
          matricula: true,
          nome: true,
        },
        orderBy: { matricula: "asc" },
        take: limit,
        skip,
      }),
      db.socio.count({ where })
    ])

    return NextResponse.json({
      data: socios,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erro ao buscar sócios:", error)
    return NextResponse.json(
      { error: "Erro ao buscar sócios" },
      { status: 500 }
    )
  }
}

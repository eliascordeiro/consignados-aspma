import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const classes = await db.classe.findMany({
      select: {
        id: true,
        classe: true,
      },
      orderBy: {
        id: 'asc'
      }
    })

    return NextResponse.json(classes)
  } catch (error) {
    console.error("Erro ao buscar classes:", error)
    return NextResponse.json(
      { error: "Erro ao buscar classes" },
      { status: 500 }
    )
  }
}

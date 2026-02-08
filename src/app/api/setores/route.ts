import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const setores = await db.setor.findMany({
      select: {
        id: true,
        codigo: true,
        setores: true,
      },
      orderBy: {
        codigo: 'asc'
      }
    })

    return NextResponse.json(setores)
  } catch (error) {
    console.error("Erro ao buscar setores:", error)
    return NextResponse.json(
      { error: "Erro ao buscar setores" },
      { status: 500 }
    )
  }
}

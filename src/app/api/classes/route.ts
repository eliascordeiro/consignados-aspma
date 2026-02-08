import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const classes = await prisma.classe.findMany({
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

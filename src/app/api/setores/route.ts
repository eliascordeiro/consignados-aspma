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

    const setores = await prisma.setor.findMany({
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

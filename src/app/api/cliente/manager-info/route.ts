import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Se for MANAGER, retorna próprio nome
    if (session.user.role === "MANAGER") {
      return NextResponse.json({
        managerName: session.user.name,
      })
    }

    // Se for USER, buscar o MANAGER criador
    if (session.user.role === "USER") {
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: {
          createdBy: {
            select: {
              name: true,
            }
          }
        }
      })

      return NextResponse.json({
        managerName: user?.createdBy?.name || null,
      })
    }

    return NextResponse.json({
      managerName: null,
    })
  } catch (error) {
    console.error("Erro ao buscar info do MANAGER:", error)
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    )
  }
}

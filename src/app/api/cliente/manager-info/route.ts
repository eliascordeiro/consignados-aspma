import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Se for MANAGER, retorna próprio nome e logo
    if (session.user.role === "MANAGER") {
      const manager = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { name: true, logo: true, managerPrincipalId: true },
      })

      // Se é sub-manager, buscar logo do manager principal
      if (manager?.managerPrincipalId) {
        const principal = await prisma.users.findUnique({
          where: { id: manager.managerPrincipalId },
          select: { name: true, logo: true },
        })
        return NextResponse.json({
          managerName: principal?.name || manager?.name,
          managerLogo: principal?.logo || manager?.logo || null,
        })
      }

      return NextResponse.json({
        managerName: manager?.name || session.user.name,
        managerLogo: manager?.logo || null,
      })
    }

    // Se for USER, buscar o MANAGER criador
    if (session.user.role === "USER") {
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: {
          users: {
            select: {
              name: true,
              logo: true,
            }
          }
        }
      })

      return NextResponse.json({
        managerName: user?.users?.name || null,
        managerLogo: user?.users?.logo || null,
      })
    }

    return NextResponse.json({
      managerName: null,
      managerLogo: null,
    })
  } catch (error) {
    console.error("Erro ao buscar info do MANAGER:", error)
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    )
  }
}

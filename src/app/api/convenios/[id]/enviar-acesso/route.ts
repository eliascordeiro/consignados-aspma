import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendConvenioAccessEmail } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const numericId = parseInt(id)

    if (isNaN(numericId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const convenio = await prisma.convenio.findUnique({
      where: { id: numericId },
      select: { email: true, razao_soc: true, fantasia: true, nome: true },
    })

    if (!convenio) {
      return NextResponse.json({ error: "Convênio não encontrado" }, { status: 404 })
    }

    if (!convenio.email) {
      return NextResponse.json(
        { error: "Este convênio não possui email de acesso cadastrado" },
        { status: 400 }
      )
    }

    const name = convenio.razao_soc || convenio.fantasia || convenio.nome || "Convênio"
    const result = await sendConvenioAccessEmail(convenio.email, name)

    if (result.success) {
      return NextResponse.json({ message: "Email enviado com sucesso" })
    } else {
      return NextResponse.json(
        { error: "Erro ao enviar email. Tente novamente." },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Erro ao enviar email de acesso:", error)
    return NextResponse.json(
      { error: "Erro ao enviar email" },
      { status: 500 }
    )
  }
}

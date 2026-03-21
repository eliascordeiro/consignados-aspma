import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { sendPasswordResetEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email é obrigatório" },
        { status: 400 }
      )
    }

    // Buscar usuário na tabela users
    const user = await prisma.users.findUnique({
      where: { email },
    })

    // Buscar convênio pela tabela convenio
    const convenio = !user
      ? await prisma.convenio.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        })
      : null

    // Por segurança, sempre retorna sucesso mesmo se o email não existir
    if (!user && !convenio) {
      return NextResponse.json({
        message: "Se o email existir, você receberá um link de redefinição",
      })
    }

    // Gerar token único
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hora

    if (user) {
      // Salvar token no usuário
      await prisma.users.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      })
    } else if (convenio) {
      // Salvar token no convênio
      await prisma.convenio.update({
        where: { id: convenio.id },
        data: { resetToken, resetTokenExpiry },
      })
    }

    // Enviar email
    try {
      await sendPasswordResetEmail(email, resetToken)
    } catch (emailError) {
      console.error('❌ Falha ao enviar email de reset para', email, emailError)
    }

    return NextResponse.json({
      message: "Se o email existir, você receberá um link de redefinição",
    })
  } catch (error) {
    console.error("Erro ao solicitar reset de senha:", error)
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    )
  }
}

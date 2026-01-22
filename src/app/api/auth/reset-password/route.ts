import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    console.log("🔐 Reset de senha solicitado")
    console.log("   Token recebido:", token?.substring(0, 10) + "...")

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token e senha são obrigatórios" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter no mínimo 6 caracteres" },
        { status: 400 }
      )
    }

    // Buscar usuário pelo token
    const user = await prisma.users.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gte: new Date(), // Token ainda válido
        },
      },
    })

    console.log("   Usuário encontrado:", user ? `${user.name} (${user.email})` : "NENHUM")

    if (!user) {
      console.log("   ❌ Token inválido ou expirado")
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 400 }
      )
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log("   Atualizando senha do usuário...")

    // Atualizar senha e limpar token
    await prisma.users.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    console.log("   ✅ Senha atualizada com sucesso!")

    return NextResponse.json({
      message: "Senha redefinida com sucesso!",
    })
  } catch (error) {
    console.error("Erro ao redefinir senha:", error)
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    )
  }
}

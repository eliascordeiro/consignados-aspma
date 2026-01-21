import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, email, currentPassword, newPassword } = body

    // Validações básicas
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Nome e email são obrigatórios" },
        { status: 400 }
      )
    }

    // Verificar se o email já está em uso por outro usuário
    const existingUser = await prisma.users.findFirst({
      where: {
        email: email.trim(),
        NOT: {
          id: session.user.id
        }
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está em uso" },
        { status: 400 }
      )
    }

    // Buscar usuário atual
    const user = await prisma.users.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      )
    }

    // Preparar dados para atualização
    const updateData: any = {
      name: name.trim(),
      email: email.trim(),
    }

    // Se está alterando a senha, validar senha atual
    if (currentPassword && newPassword) {
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
      
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Senha atual incorreta" },
          { status: 400 }
        )
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "A nova senha deve ter no mínimo 6 caracteres" },
          { status: 400 }
        )
      }

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 10)
      updateData.password = hashedPassword
    }

    // Atualizar usuário
    const updatedUser = await prisma.users.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    })

    return NextResponse.json({
      message: "Perfil atualizado com sucesso",
      user: updatedUser
    })
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar perfil" },
      { status: 500 }
    )
  }
}

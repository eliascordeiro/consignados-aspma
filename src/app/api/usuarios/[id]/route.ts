import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const updateUserSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").optional(),
  email: z.string().email("Email inválido").optional(),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "USER"]).optional(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
})

// PUT - Atualizar usuário
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Verificar se usuário existe
    const existingUser = await prisma.users.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      )
    }

    // Se email foi alterado, verificar se já existe
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await prisma.users.findUnique({
        where: { email: validatedData.email },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: "Email já cadastrado" },
          { status: 400 }
        )
      }
    }

    // Preparar dados para atualização
    const updateData: any = {
      name: validatedData.name,
      email: validatedData.email,
      role: validatedData.role,
      cpf: validatedData.cpf,
      phone: validatedData.phone,
      active: validatedData.active,
      permissions: validatedData.permissions,
    }

    // Se senha foi fornecida, fazer hash
    if (validatedData.password) {
      updateData.password = await bcrypt.hash(validatedData.password, 10)
    }

    const user = await prisma.users.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        active: true,
        permissions: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      )
    }
    
    console.error("Erro ao atualizar usuário:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar usuário" },
      { status: 500 }
    )
  }
}

// DELETE - Deletar usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se usuário existe
    const existingUser = await prisma.users.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      )
    }

    // Não permitir deletar o próprio usuário logado
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Você não pode deletar sua própria conta" },
        { status: 400 }
      )
    }

    await prisma.users.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Usuário deletado com sucesso" })
  } catch (error) {
    console.error("Erro ao deletar usuário:", error)
    return NextResponse.json(
      { error: "Erro ao deletar usuário" },
      { status: 500 }
    )
  }
}

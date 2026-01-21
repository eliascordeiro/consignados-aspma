import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const userSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().default(true),
  permissions: z.array(z.string()).optional(),
})

// PUT - Atualizar usuário subordinado
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user || session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se o usuário pertence ao MANAGER
    const existingUser = await prisma.users.findFirst({
      where: {
        id,
        createdById: session.user.id,
        role: "USER",
      },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado ou sem permissão" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validatedData = userSchema.parse(body)

    // Verificar se email já existe (exceto o próprio usuário)
    const emailExists = await prisma.users.findFirst({
      where: {
        email: validatedData.email,
        NOT: { id },
      },
    })

    if (emailExists) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 400 }
      )
    }

    // Permissões do MANAGER
    const managerPermissions = (session.user as any).permissions || []

    // Filtrar permissões
    const allowedPermissions = validatedData.permissions
      ? validatedData.permissions.filter(p => managerPermissions.includes(p))
      : []

    // Preparar dados de atualização
    const updateData: any = {
      name: validatedData.name,
      email: validatedData.email,
      cpf: validatedData.cpf,
      phone: validatedData.phone,
      active: validatedData.active,
      permissions: allowedPermissions,
    }

    // Atualizar senha se fornecida
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
        cpf: true,
        phone: true,
        active: true,
        permissions: true,
        createdAt: true,
        role: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
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

// DELETE - Excluir usuário subordinado
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user || session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se o usuário pertence ao MANAGER
    const existingUser = await prisma.users.findFirst({
      where: {
        id,
        createdById: session.user.id,
        role: "USER",
      },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado ou sem permissão" },
        { status: 404 }
      )
    }

    await prisma.users.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Usuário excluído com sucesso" })
  } catch (error) {
    console.error("Erro ao excluir usuário:", error)
    return NextResponse.json(
      { error: "Erro ao excluir usuário" },
      { status: 500 }
    )
  }
}

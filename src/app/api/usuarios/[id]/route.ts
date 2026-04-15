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

// GET - Buscar usuário por id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        active: true,
        logo: true,
        permissions: true,
        createdAt: true,
        _count: { select: { subManagers: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Erro ao buscar usuário:", error)
    return NextResponse.json({ error: "Erro ao buscar usuário" }, { status: 500 })
  }
}

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

    // Se é um MANAGER e as permissões foram alteradas, atualizar subordinados
    if (existingUser.role === "MANAGER" && validatedData.permissions) {
      const newPermissions = validatedData.permissions
      const oldPermissions = existingUser.permissions || []
      
      // Permissões que foram removidas do MANAGER
      const removedPermissions = oldPermissions.filter(p => !newPermissions.includes(p))
      
      if (removedPermissions.length > 0) {
        // Buscar todos os usuários subordinados
        const subordinates = await prisma.users.findMany({
          where: { createdById: id },
          select: { id: true, permissions: true }
        })

        // Atualizar cada subordinado removendo as permissões que o MANAGER não tem mais
        for (const subordinate of subordinates) {
          const subordinatePermissions = subordinate.permissions || []
          // Manter apenas permissões que o MANAGER ainda tem
          const updatedPermissions = subordinatePermissions.filter(p => 
            newPermissions.includes(p)
          )

          if (updatedPermissions.length !== subordinatePermissions.length) {
            await prisma.users.update({
              where: { id: subordinate.id },
              data: { permissions: updatedPermissions }
            })
          }
        }
      }
    }

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

    // Verificar dependências que impedem exclusão
    const [consignadosCount, vendasCount, subordinatesCount] = await Promise.all([
      prisma.consignados.count({ where: { userId: id } }),
      prisma.venda.count({ where: { userId: id } }),
      prisma.users.count({ where: { createdById: id } }),
    ])

    if (consignadosCount > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: usuário possui ${consignadosCount} consignado(s) vinculado(s). Desative-o em vez de excluir.` },
        { status: 400 }
      )
    }

    if (vendasCount > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: usuário possui ${vendasCount} venda(s) vinculada(s). Desative-o em vez de excluir.` },
        { status: 400 }
      )
    }

    if (subordinatesCount > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: usuário possui ${subordinatesCount} usuário(s) subordinado(s). Remova ou transfira-os antes.` },
        { status: 400 }
      )
    }

    // Limpar dependências e excluir em transação
    await prisma.$transaction([
      prisma.venda.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.venda.updateMany({ where: { updatedById: id }, data: { updatedById: null } }),
      prisma.parcela.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.parcela.updateMany({ where: { updatedById: id }, data: { updatedById: null } }),
      prisma.users.updateMany({ where: { managerPrincipalId: id }, data: { managerPrincipalId: null } }),
      prisma.auditLog.deleteMany({ where: { userId: id } }),
      prisma.margemHistorico.deleteMany({ where: { userId: id } }),
      prisma.classe.deleteMany({ where: { userId: id } }),
      prisma.setor.deleteMany({ where: { userId: id } }),
      prisma.webAuthnAuthenticator.deleteMany({ where: { userId: id } }),
      prisma.users.delete({ where: { id } }),
    ])

    return NextResponse.json({ message: "Usuário deletado com sucesso" })
  } catch (error: any) {
    console.error("Erro ao deletar usuário:", error)
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: "Não é possível excluir: existem registros vinculados a este usuário. Desative-o em vez de excluir." },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Erro ao deletar usuário" },
      { status: 500 }
    )
  }
}

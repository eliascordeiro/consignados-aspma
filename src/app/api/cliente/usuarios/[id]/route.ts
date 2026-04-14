import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { hasPermission } from "@/lib/permissions"

function isManagerOrPermitted(user: any, perm: string): boolean {
  if (!user) return false
  if (user.role === 'MANAGER') return true
  return hasPermission(user, perm)
}

// Retorna o ID do MANAGER raiz da hierarquia (para filtrar createdById)
async function getRootOwnerId(user: any): Promise<string> {
  if (user.role === 'MANAGER') {
    // Se é sub-manager, escalar para o principal
    try {
      const mgr = await prisma.users.findUnique({
        where: { id: user.id },
        select: { managerPrincipalId: true } as any,
      }) as any
      if (mgr?.managerPrincipalId) return mgr.managerPrincipalId
    } catch {
      // Migration pendente — ignora
    }
    return user.id
  }
  if (!user.createdById) return user.id
  const creator = await prisma.users.findUnique({
    where: { id: user.createdById },
    select: { id: true, role: true, createdById: true },
  })
  if (!creator) return user.id
  if (creator.role === 'MANAGER') return creator.id
  // Nível 2: criador do criador é o MANAGER
  return creator.createdById ?? creator.id
}

const userSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().default(true),
  permissions: z.array(z.string()).optional(),
})

// GET - Buscar usuário por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !isManagerOrPermitted(session.user, 'usuarios.view')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const { id } = await params
    const ownerId = await getRootOwnerId(session.user)
    const user = await prisma.users.findFirst({
      where: { id, createdById: ownerId, role: "USER" },
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
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (error) {
    console.error("Erro ao buscar usuário:", error)
    return NextResponse.json({ error: "Erro ao buscar usuário" }, { status: 500 })
  }
}

// PUT - Atualizar usuário subordinado
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user || !isManagerOrPermitted(session.user, 'usuarios.edit')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se o usuário pertence ao owner correto
    const ownerId = await getRootOwnerId(session.user)
    const existingUser = await prisma.users.findFirst({
      where: {
        id,
        createdById: ownerId,
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
    
    if (!session?.user || !isManagerOrPermitted(session.user, 'usuarios.delete')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se o usuário pertence ao owner correto
    const ownerId = await getRootOwnerId(session.user)
    const existingUser = await prisma.users.findFirst({
      where: {
        id,
        createdById: ownerId,
        role: "USER",
      },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: "Usuário não encontrado ou sem permissão" },
        { status: 404 }
      )
    }

    // Verificar dependências que impedem exclusão (FKs required não-anuláveis)
    const [consignadosCount, vendasCount] = await Promise.all([
      prisma.consignados.count({ where: { userId: id } }),
      prisma.venda.count({ where: { userId: id } }),
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

    // Limpar dependências e excluir em transação
    await prisma.$transaction([
      // FKs anuláveis: desvincula registros
      prisma.venda.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.venda.updateMany({ where: { updatedById: id }, data: { updatedById: null } }),
      prisma.parcela.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.parcela.updateMany({ where: { updatedById: id }, data: { updatedById: null } }),
      // FKs self-ref: desvincular subordinados
      prisma.users.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.users.updateMany({ where: { managerPrincipalId: id }, data: { managerPrincipalId: null } }),
      // Excluir registros pertencentes ao usuário
      prisma.auditLog.deleteMany({ where: { userId: id } }),
      prisma.margemHistorico.deleteMany({ where: { userId: id } }),
      prisma.classe.deleteMany({ where: { userId: id } }),
      prisma.setor.deleteMany({ where: { userId: id } }),
      // WebAuthnAuthenticator cascade automático, mas limpar explicitamente
      prisma.webAuthnAuthenticator.deleteMany({ where: { userId: id } }),
      // Finalmente, excluir o usuário
      prisma.users.delete({ where: { id } }),
    ])

    return NextResponse.json({ message: "Usuário excluído com sucesso" })
  } catch (error: any) {
    console.error("Erro ao excluir usuário:", error)
    // Capturar erros de FK não tratados
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: "Não é possível excluir: existem registros vinculados a este usuário. Desative-o em vez de excluir." },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Erro ao excluir usuário" },
      { status: 500 }
    )
  }
}

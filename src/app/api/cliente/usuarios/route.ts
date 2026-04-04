import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { sendWelcomeEmail } from "@/lib/email"
import { hasPermission } from "@/lib/permissions"

function isManagerOrPermitted(user: any, perm: string): boolean {
  if (!user) return false
  if (user.role === 'MANAGER') return true
  return hasPermission(user, perm)
}

// Retorna o ID do MANAGER raiz da hierarquia (para filtrar createdById)
// Resolve sub-managers (managerPrincipalId) para que o principal seja sempre o dono
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

// Somente USER nível 1 (criado por MANAGER) pode criar novos usuários
async function canCreateUser(user: any): Promise<boolean> {
  if (user.role === 'MANAGER') return true
  if (!user.createdById) return false
  const criador = await prisma.users.findUnique({
    where: { id: user.createdById },
    select: { role: true },
  })
  return criador?.role === 'MANAGER'
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

// GET - Listar usuários criados pelo MANAGER
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user || !isManagerOrPermitted(session.user, 'usuarios.view')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""

    const ownerId = await getRootOwnerId(session.user)

    const users = await prisma.users.findMany({
      where: {
        createdById: ownerId,
        role: "USER",
        OR: search ? [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { cpf: { contains: search, mode: "insensitive" } },
        ] : undefined,
      },
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
        passwordChangedAt: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Erro ao buscar usuários:", error)
    return NextResponse.json(
      { error: "Erro ao buscar usuários" },
      { status: 500 }
    )
  }
}

// POST - Criar novo usuário subordinado
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user || !isManagerOrPermitted(session.user, 'usuarios.create')) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Bloquear criação se já é nível 2 (sub-usuário não pode criar mais usuários)
    if (!await canCreateUser(session.user)) {
      return NextResponse.json({ error: "Nível hierárquico máximo atingido" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = userSchema.parse(body)

    // Verificar se email já existe
    const existingUser = await prisma.users.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email já cadastrado" },
        { status: 400 }
      )
    }

    // Permissões do MANAGER
    const managerPermissions = (session.user as any).permissions || []

    // Filtrar permissões: usuário só pode ter permissões que o MANAGER também possui
    const allowedPermissions = validatedData.permissions
      ? validatedData.permissions.filter(p => managerPermissions.includes(p))
      : []

    // Criar usuário SEM senha - deverá usar "Criar ou Redefinir Senha" no login
    // Usamos um hash impossível para forçar o reset de senha
    const hashedPassword = await bcrypt.hash(
      `temp_${Date.now()}_${Math.random()}`,
      10
    )

    const user = await prisma.users.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: "USER",
        cpf: validatedData.cpf,
        phone: validatedData.phone,
        active: validatedData.active,
        permissions: allowedPermissions,
        createdById: await getRootOwnerId(session.user), // Vincula ao MANAGER principal (resolve sub-managers)
      },
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

    // Enviar email de boas-vindas
    try {
      await sendWelcomeEmail(
        user.email,
        user.name,
        session.user.name || "Administrador"
      )
      console.log(`✅ Email de boas-vindas enviado para ${user.email}`)
    } catch (emailError) {
      console.error("❌ Erro ao enviar email:", emailError)
      // Não falhar a criação se o email falhar
    }

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Erro ao criar usuário:", error)
    return NextResponse.json(
      { error: "Erro ao criar usuário" },
      { status: 500 }
    )
  }
}

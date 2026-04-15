import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const userSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "USER"]),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().default(true),
  permissions: z.array(z.string()).optional(),
  managerPrincipalId: z.string().optional(),
})

// GET - Listar usuários
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const role = searchParams.get("role")
    const managerPrincipalId = searchParams.get("managerPrincipalId")

    const searchFilter = search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ] }
      : undefined

    // Tenta query completa com managerPrincipalId; cai back se coluna ainda não existe
    try {
      // Busca IDs de usuários vinculados a convênios para excluí-los da listagem
      // Apenas exclui USER (auto-criados para convênio), nunca ADMIN/MANAGER
      const convenioUsers = await prisma.convenio.findMany({
        where: { userId: { not: null } },
        select: { userId: true },
      })
      const convenioUserIdsRaw = convenioUsers.map((c) => c.userId!).filter(Boolean)

      // Filtrar: manter apenas USERs na lista de exclusão (ADMIN/MANAGER não devem ser excluídos)
      let convenioUserIds: string[] = []
      if (convenioUserIdsRaw.length > 0) {
        const adminManagerIds = await prisma.users.findMany({
          where: { id: { in: convenioUserIdsRaw }, role: { in: ['ADMIN', 'MANAGER'] } },
          select: { id: true },
        })
        const protectedIds = new Set(adminManagerIds.map(u => u.id))
        convenioUserIds = convenioUserIdsRaw.filter(id => !protectedIds.has(id))
      }

      const where: any = { AND: [] }
      // Excluir usuários de convênios da listagem
      if (convenioUserIds.length > 0) {
        where.AND.push({ id: { notIn: convenioUserIds } })
      }
      if (role) where.AND.push({ role: role as any })
      if (managerPrincipalId) {
        where.AND.push({ managerPrincipalId })
      }
      if (searchFilter) where.AND.push(searchFilter)

      const users = await prisma.users.findMany({
        where,
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
          _count: { select: { subManagers: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json(users)
    } catch (queryErr: any) {
      // Fallback: coluna managerPrincipalId pode ainda não existir no DB (migration pendente)
      console.warn("[usuarios GET] Fallback query (migration pendente?):", queryErr?.message)

      // Busca IDs de usuários vinculados a convênios para excluí-los da listagem
      // Apenas exclui USER (auto-criados para convênio), nunca ADMIN/MANAGER
      const convenioUsersFallback = await prisma.convenio.findMany({
        where: { userId: { not: null } },
        select: { userId: true },
      })
      const convenioUserIdsRawFb = convenioUsersFallback.map((c) => c.userId!).filter(Boolean)

      let convenioUserIdsFallback: string[] = []
      if (convenioUserIdsRawFb.length > 0) {
        const adminManagerIdsFb = await prisma.users.findMany({
          where: { id: { in: convenioUserIdsRawFb }, role: { in: ['ADMIN', 'MANAGER'] } },
          select: { id: true },
        })
        const protectedIdsFb = new Set(adminManagerIdsFb.map(u => u.id))
        convenioUserIdsFallback = convenioUserIdsRawFb.filter(id => !protectedIdsFb.has(id))
      }

      const where: any = { AND: [] }
      if (convenioUserIdsFallback.length > 0) {
        where.AND.push({ id: { notIn: convenioUserIdsFallback } })
      }
      if (role) where.AND.push({ role: role as any })
      if (searchFilter) where.AND.push(searchFilter)

      const users = await prisma.users.findMany({
        where,
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
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json(users)
    }
  } catch (error) {
    console.error("Erro ao listar usuários:", error)
    return NextResponse.json(
      { error: "Erro ao listar usuários" },
      { status: 500 }
    )
  }
}

// POST - Criar usuário
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
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

    // Hash da senha
    const hashedPassword = await bcrypt.hash(
      validatedData.password || "123456",
      10
    )

    // Tenta criar com managerPrincipalId; se coluna não existe ainda, cria sem ele
    let user
    try {
      user = await prisma.users.create({
        data: {
          name: validatedData.name,
          email: validatedData.email,
          password: hashedPassword,
          role: validatedData.role,
          cpf: validatedData.cpf,
          phone: validatedData.phone,
          active: validatedData.active,
          permissions: validatedData.permissions || [],
          managerPrincipalId: validatedData.managerPrincipalId || null,
        } as any,
        select: {
          id: true, name: true, email: true, role: true,
          cpf: true, phone: true, active: true, permissions: true, createdAt: true,
        },
      })
    } catch (createErr: any) {
      // Coluna managerPrincipalId ainda não existe → cria sem ela
      if (createErr?.code === 'P2022') {
        user = await prisma.users.create({
          data: {
            name: validatedData.name,
            email: validatedData.email,
            password: hashedPassword,
            role: validatedData.role,
            cpf: validatedData.cpf,
            phone: validatedData.phone,
            active: validatedData.active,
            permissions: validatedData.permissions || [],
          },
          select: {
            id: true, name: true, email: true, role: true,
            cpf: true, phone: true, active: true, permissions: true, createdAt: true,
          },
        })
      } else {
        throw createErr
      }
    }
    // (bloco select abaixo removido — já incluso nos creates acima)
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
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

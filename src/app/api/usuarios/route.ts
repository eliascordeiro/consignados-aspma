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

    const users = await prisma.user.findMany({
      where: {
        AND: [
          role ? { role: role as any } : {},
          {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        active: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(users)
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
    const existingUser = await prisma.user.findUnique({
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

    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        cpf: validatedData.cpf,
        phone: validatedData.phone,
        active: validatedData.active,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cpf: true,
        phone: true,
        active: true,
        createdAt: true,
      },
    })

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

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const empresaSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  cnpj: z.string().optional(),
  tipo: z.enum(["PUBLICA", "PRIVADA"]),
  telefone: z.string().optional(),
  email: z.string().email("Email inválido").optional(),
  contato: z.string().optional(),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  ativo: z.boolean().default(true),
})

// GET - Listar consignatárias do usuário
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""

    // MANAGER e ADMIN podem ver todas as empresas
    const where: any = session.user.role === "MANAGER" || session.user.role === "ADMIN"
      ? {}
      : { userId: session.user.id }

    if (search) {
      where.nome = {
        contains: search,
        mode: "insensitive"
      }
    }

    const empresas = await prisma.empresa.findMany({
      where,
      orderBy: {
        nome: "asc",
      },
    })

    return NextResponse.json(empresas)
  } catch (error) {
    console.error("Erro ao listar consignatárias:", error)
    return NextResponse.json(
      { error: "Erro ao listar consignatárias" },
      { status: 500 }
    )
  }
}

// POST - Criar consignatária
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = empresaSchema.parse(body)

    // Verificar se CNPJ já existe
    if (validatedData.cnpj) {
      const existingEmpresa = await prisma.empresa.findFirst({
        where: { cnpj: validatedData.cnpj },
      })

      if (existingEmpresa) {
        return NextResponse.json(
          { error: "CNPJ já cadastrado" },
          { status: 400 }
        )
      }
    }

    const empresa = await prisma.empresa.create({
      data: {
        ...validatedData,
        userId: session.user.id,
      },
    })

    return NextResponse.json(empresa, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    
    console.error("Erro ao criar consignatária:", error)
    return NextResponse.json(
      { error: "Erro ao criar consignatária" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const empresaSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  cnpj: z.string().optional(),
  tipo: z.enum(["PUBLICO", "PRIVADO"]),
  telefone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  contato: z.string().optional(),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  ativo: z.boolean().default(true),
})

//PUT - Atualizar consignatária
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id: paramId } = await params
    const id = parseInt(paramId)
    const body = await request.json()
    const validatedData = empresaSchema.parse(body)

    // Verificar se a empresa pertence ao usuário
    const existing = await prisma.empresa.findUnique({
      where: { id }
    })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Consignatária não encontrada" },
        { status: 404 }
      )
    }

    // Verificar se CNPJ já existe em outra empresa
    if (validatedData.cnpj && validatedData.cnpj !== existing.cnpj) {
      const existingCNPJ = await prisma.empresa.findUnique({
        where: { cnpj: validatedData.cnpj },
      })

      if (existingCNPJ && existingCNPJ.id !== id) {
        return NextResponse.json(
          { error: "CNPJ já cadastrado" },
          { status: 400 }
        )
      }
    }

    const empresa = await prisma.empresa.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(empresa)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    
    console.error("Erro ao atualizar consignatária:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar consignatária" },
      { status: 500 }
    )
  }
}

// DELETE - Excluir consignatária
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id: paramId } = await params
    const id = parseInt(paramId)

    // Verificar se a empresa pertence ao usuário
    const existing = await prisma.empresa.findUnique({
      where: { id }
    })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Consignatária não encontrada" },
        { status: 404 }
      )
    }

    // Verificar se há sócios vinculados
    const sociosCount = await prisma.socio.count({
      where: { empresaId: id }
    })

    if (sociosCount > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Existem ${sociosCount} funcionário(s) vinculado(s) a esta consignatária.` },
        { status: 400 }
      )
    }

    await prisma.empresa.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir consignatária:", error)
    return NextResponse.json(
      { error: "Erro ao excluir consignatária" },
      { status: 500 }
    )
  }
}

import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

// Função helper para converter o campo libera em tipo
function getTipoFromLibera(libera: string | null | undefined): string {
  if (libera === 'X') return 'BANCO'
  if (libera === 'T') return 'TESTE'
  return 'COMERCIO' // em branco ou qualquer outro valor
}

const convenioSchema = z.object({
  codigo: z.string().optional(),
  razao_soc: z.string().min(1, "Razão Social é obrigatória"),
  fantasia: z.string().optional(),
  nome: z.string().optional(),
  cnpj: z.string().optional(),
  cgc: z.string().optional(),
  tipo: z.string().optional(),
  libera: z.string().optional(),
  desconto: z.union([z.string(), z.number()]).optional().transform(val => {
    if (!val) return null
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? null : num
  }),
  parcelas: z.union([z.string(), z.number()]).optional().transform(val => {
    if (!val) return null
    const num = typeof val === 'string' ? parseInt(val) : val
    return isNaN(num) ? null : num
  }),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  uf: z.string().optional(),
  telefone: z.string().optional(),
  fone: z.string().optional(),
  fax: z.string().optional(),
  contato: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  ativo: z.boolean().default(true),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se o convênio existe e pertence ao usuário
    const existing = await db.convenio.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Convênio não encontrado" },
        { status: 404 }
      )
    }

    // Apenas verificar ownership se não for MANAGER/ADMIN
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      if (existing.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Sem permissão para editar este convênio" },
          { status: 403 }
        )
      }
    }

    const body = await req.json()
    const data = convenioSchema.parse(body)

    // Verificar CNPJ duplicado (exceto o próprio registro)
    if (data.cnpj && data.cnpj !== existing.cnpj) {
      const duplicate = await db.convenio.findFirst({
        where: {
          cnpj: data.cnpj,
          NOT: { id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "CNPJ já cadastrado" },
          { status: 400 }
        )
      }
    }

    // Gerar campos derivados
    const dataToSave = {
      ...data,
      nome: data.razao_soc || data.fantasia || existing.nome || 'Sem nome',
      cgc: data.cnpj || data.cgc || existing.cgc,
      uf: data.estado || data.uf || existing.uf,
      fone: data.telefone || data.fone || existing.fone,
      tipo: getTipoFromLibera(data.libera),
    }

    const convenio = await db.convenio.update({
      where: { id },
      data: dataToSave,
    })

    return NextResponse.json(convenio)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Erro ao atualizar convênio:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar convênio" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se o convênio existe e pertence ao usuário
    const existing = await db.convenio.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Convênio não encontrado" },
        { status: 404 }
      )
    }

    // Apenas verificar ownership se não for MANAGER/ADMIN
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      if (existing.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Sem permissão para excluir este convênio" },
          { status: 403 }
        )
      }
    }

    await db.convenio.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir convênio:", error)
    return NextResponse.json(
      { error: "Erro ao excluir convênio" },
      { status: 500 }
    )
  }
}

import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getDataUserId } from "@/lib/get-data-user-id"
import { randomBytes } from "crypto"
import { hasPermission } from "@/lib/permissions"

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
  desconto: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? null : num
  }),
  parcelas: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    if (!hasPermission(session.user, 'convenios.view') && !hasPermission(session.user, 'convenios.edit')) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }
    const { id } = await params
    const role = (session.user as any).role
    const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER'
    let convenio
    if (isAdminOrManager) {
      convenio = await db.convenio.findUnique({ where: { id: parseInt(id) } })
    } else {
      const dataUserId = await getDataUserId(session as any)
      convenio = await db.convenio.findFirst({ where: { id: parseInt(id), userId: dataUserId } })
    }
    if (!convenio) return NextResponse.json({ error: "Convênio não encontrado" }, { status: 404 })
    return NextResponse.json(convenio)
  } catch (error) {
    console.error("Erro ao buscar convênio:", error)
    return NextResponse.json({ error: "Erro ao buscar convênio" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id: paramId } = await params
    const id = parseInt(paramId)
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

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

    // ADMIN e MANAGER podem editar qualquer convênio; USER só edita os próprios
    const putRole = (session.user as any).role
    if (putRole !== 'ADMIN' && putRole !== 'MANAGER') {
      const dataUserId = await getDataUserId(session as any)
      if (existing.userId !== null && existing.userId !== dataUserId) {
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

    // Sync email changes to the linked users record
    const newEmail = data.email ? data.email.trim().toLowerCase() : null
    const oldEmail = existing.email ? existing.email.trim().toLowerCase() : null

    if (!newEmail && existing.userId) {
      // Email foi removido — bloquear ou excluir o usuário vinculado
      const vendasCount = await db.venda.count({ where: { convenioId: id } })
      if (vendasCount === 0) {
        // Sem vendas → excluir o usuário
        await db.users.delete({ where: { id: existing.userId } }).catch(() => null)
      } else {
        // Com vendas → bloquear o usuário (active = false)
        await db.users.update({ where: { id: existing.userId }, data: { active: false } }).catch(() => null)
      }
      ;(dataToSave as Record<string, unknown>).userId = null
    } else if (newEmail && newEmail !== oldEmail) {
      if (existing.userId) {
        // Convenio already has a linked user — update its email if not taken by another
        const emailTaken = await db.users.findFirst({
          where: { email: newEmail, NOT: { id: existing.userId } },
        })
        if (emailTaken) {
          return NextResponse.json(
            { error: 'Este email já está em uso por outro cadastro. Escolha um email diferente.' },
            { status: 400 }
          )
        }
        await db.users.update({
          where: { id: existing.userId },
          data: { email: newEmail },
        })
      } else {
        // No linked user yet — create one with a sentinel password
        const nomeUser = (data.fantasia || data.razao_soc || 'Convênio').trim()
        let convenioUserId: string | null = null
        const existingUser = await db.users.findUnique({ where: { email: newEmail } })
        if (existingUser) {
          convenioUserId = existingUser.id
        } else {
          const newUser = await db.users.create({
            data: {
              email: newEmail,
              name: nomeUser,
              password: `!${randomBytes(32).toString('hex')}`,
              role: 'USER',
              active: true,
              createdById: session.user!.id,
            },
          })
          convenioUserId = newUser.id
        }
        // Attach userId so this block is only reached once
        ;(dataToSave as Record<string, unknown>).userId = convenioUserId
      }
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

    if (!hasPermission(session.user, 'convenios.delete')) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { id: paramId } = await params
    const id = parseInt(paramId)
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

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

    // ADMIN e MANAGER podem excluir qualquer convênio; USER só exclui os próprios
    const delRole = (session.user as any).role
    if (delRole !== 'ADMIN' && delRole !== 'MANAGER') {
      const dataUserIdDel = await getDataUserId(session as any)
      if (existing.userId !== null && existing.userId !== dataUserIdDel) {
        return NextResponse.json(
          { error: "Sem permissão para excluir este convênio" },
          { status: 403 }
        )
      }
    }

    // Verificar se o convênio tem vendas associadas
    const vendasCount = await db.venda.count({ where: { convenioId: id } })

    if (vendasCount > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: este convênio possui ${vendasCount} venda(s) associada(s). Desative-o ao invés de excluir.` },
        { status: 400 }
      )
    }

    // Se tem usuário vinculado e não tem vendas, deletar o usuário também
    if (existing.userId) {
      await db.users.delete({ where: { id: existing.userId } }).catch(() => null)
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

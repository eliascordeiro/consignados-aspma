import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDataUserId } from "@/lib/get-data-user-id"
import { hasPermission } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Permitir acesso se:
    // 1. Tem funcionarios.view (acesso ao módulo funcionários)
    // 2. Tem vendas.* (precisa ver sócios para criar/editar vendas)
    const hasFuncionariosAccess = hasPermission(session.user, 'funcionarios.view')
    const hasVendasAccess = 
      hasPermission(session.user, 'vendas.view') ||
      hasPermission(session.user, 'vendas.create') ||
      hasPermission(session.user, 'vendas.edit')
    
    if (!hasFuncionariosAccess && !hasVendasAccess) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Buscar userId correto (herda dados do MANAGER se for subordinado)
    const dataUserId = await getDataUserId(session as any)

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const where: any = { userId: dataUserId }

    if (search) {
      const isOnlyNumbers = /^\d+$/.test(search)

      // De/Para: se a busca for numérica, verifica mapeamento na tabela matriculas
      const matriculasAlternativas: string[] = []
      if (isOnlyNumbers) {
        const numMatricula = parseInt(search, 10)
        if (!isNaN(numMatricula)) {
          try {
            const mappings = await db.$queryRaw<{ matricula_antiga: number; matricula_atual: number }[]>`
              SELECT matricula_antiga, matricula_atual FROM matriculas
              WHERE matricula_antiga = ${numMatricula}::integer
                 OR matricula_atual  = ${numMatricula}::integer
            `
            for (const m of mappings) {
              const antiga = m.matricula_antiga.toString()
              const atual = m.matricula_atual.toString()
              if (antiga !== search) matriculasAlternativas.push(antiga)
              if (atual !== search) matriculasAlternativas.push(atual)
            }
          } catch { /* tabela inexistente ou erro — ignora */ }
        }
      }

      // Se for numérico, tentar match exato primeiro (matrícula exata ou via de/para)
      if (isOnlyNumbers) {
        const exactMatch = await db.socio.findFirst({
          where: {
            OR: [
              { matricula: search },
              ...matriculasAlternativas.map(m => ({ matricula: m })),
            ],
            userId: dataUserId,
          }
        })

        if (exactMatch) {
          // Achou exato (ou de/para) → restringe a equals para não vazar substrings
          where.OR = [
            { matricula: { equals: search } },
            { nome: { contains: search, mode: "insensitive" as const } },
            ...matriculasAlternativas.map(m => ({ matricula: { equals: m } })),
          ]
        } else {
          // Não achou exato → busca ampla com contains
          where.OR = [
            { matricula: { contains: search, mode: "insensitive" as const } },
            { nome: { contains: search, mode: "insensitive" as const } },
            ...matriculasAlternativas.map(m => ({ matricula: { equals: m } })),
          ]
        }
      } else {
        // Busca textual normal
        where.OR = [
          { matricula: { contains: search, mode: "insensitive" as const } },
          { nome: { contains: search, mode: "insensitive" as const } },
        ]
      }
    }

    const [socios, total] = await Promise.all([
      db.socio.findMany({
        where,
        select: {
          id: true,
          matricula: true,
          nome: true,
        },
        orderBy: { matricula: "asc" },
        take: limit,
        skip,
      }),
      db.socio.count({ where })
    ])

    return NextResponse.json({
      data: socios,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erro ao buscar sócios:", error)
    return NextResponse.json(
      { error: "Erro ao buscar sócios" },
      { status: 500 }
    )
  }
}

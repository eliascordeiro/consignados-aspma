import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog, getRequestInfo } from "@/lib/audit-log"
import { getDataUserId } from "@/lib/get-data-user-id"
import { hasPermission } from "@/lib/permissions"

// GET - Listar sócios com margem (busca, filtros, paginação)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!hasPermission(session.user, 'margem.view')) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const socioId = searchParams.get("socioId") || ""

    // Buscar userId correto (herda dados do MANAGER se for subordinado)
    const dataUserId = await getDataUserId(session as any)

    // Se buscar um sócio específico com histórico
    if (socioId) {
      const socio = await prisma.socio.findUnique({
        where: { id: socioId, userId: dataUserId },
        select: {
          id: true,
          nome: true,
          cpf: true,
          matricula: true,
          limite: true,
          margemConsig: true,
          empresa: { select: { id: true, nome: true } },
          margemHistoricos: {
            orderBy: { createdAt: "desc" },
            include: {
              usuario: { select: { id: true, name: true } }
            }
          }
        }
      })

      if (!socio) {
        return NextResponse.json({ error: "Sócio não encontrado" }, { status: 404 })
      }

      return NextResponse.json(socio)
    }

    // Listar sócios com margem (busca geral)
    const where: any = { ativo: true, userId: dataUserId }

    if (search) {
      const isNumericSearch = /^\d+$/.test(search)
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { cpf: { contains: search } },
        ...(isNumericSearch ? [{ matricula: search }] : [{ matricula: { contains: search } }]),
      ]
    }

    const [socios, total] = await Promise.all([
      prisma.socio.findMany({
        where,
        select: {
          id: true,
          nome: true,
          cpf: true,
          matricula: true,
          tipo: true,
          limite: true,
          empresa: { select: { id: true, nome: true } },
          _count: { select: { margemHistoricos: true } }
        },
        orderBy: { nome: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.socio.count({ where }),
    ])

    // Adicionar informação de fonte baseado apenas no tipo (não fazemos cálculo agora)
    const sociosComFonte = socios.map((socio) => {
      // Determina fonte baseado no tipo
      let fonteLimite = 'BD'
      if (socio.tipo === '3' || socio.tipo === '4') {
        fonteLimite = 'Local'
      } else if (socio.tipo === '1' || socio.tipo === '2' || socio.tipo === '5') {
        fonteLimite = 'ZETRA'
      }
      
      // Debug para matrícula específica
      if (socio.matricula === '222101') {
        console.log('🔍 Debug sócio 222101:', {
          tipo: socio.tipo,
          typeofTipo: typeof socio.tipo,
          fonteLimite,
          comparacao1: socio.tipo === '1',
          comparacao2: socio.tipo === '2',
          comparacao3: socio.tipo === '3',
          comparacao4: socio.tipo === '4',
          comparacao5: socio.tipo === '5',
        })
      }
      
      return {
        ...socio,
        limiteCalculado: socio.limite || 0,
        fonteLimite
      }
    })

    return NextResponse.json({ socios: sociosComFonte, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("Erro ao buscar margens:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// PUT - Alterar margem de um sócio (registra histórico)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!hasPermission(session.user, 'margem.edit')) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const body = await request.json()
    const { socioId, limite, margemConsig, motivo, observacao } = body

    if (!socioId) {
      return NextResponse.json({ error: "socioId é obrigatório" }, { status: 400 })
    }

    if (limite === undefined && margemConsig === undefined) {
      return NextResponse.json({ error: "Informe limite e/ou margemConsig" }, { status: 400 })
    }

    if (!motivo || motivo.trim() === "") {
      return NextResponse.json({ error: "Motivo é obrigatório" }, { status: 400 })
    }

    // Buscar valores atuais (filtrado pelo userId correto)
    const dataUserIdPut = await getDataUserId(session as any)
    const socioAtual = await prisma.socio.findFirst({
      where: { id: socioId, userId: dataUserIdPut },
      select: { id: true, nome: true, limite: true, margemConsig: true }
    })

    if (!socioAtual) {
      return NextResponse.json({ error: "Sócio não encontrado" }, { status: 404 })
    }

    // Preparar dados de atualização
    const updateData: any = {}
    if (limite !== undefined) updateData.limite = parseFloat(limite) || 0
    if (margemConsig !== undefined) updateData.margemConsig = parseFloat(margemConsig) || 0

    // Transação: atualizar sócio + criar histórico
    const [socioAtualizado, historico] = await prisma.$transaction([
      prisma.socio.update({
        where: { id: socioId },
        data: updateData,
        select: {
          id: true,
          nome: true,
          limite: true,
          margemConsig: true,
        }
      }),
      prisma.margemHistorico.create({
        data: {
          socioId,
          userId: session.user.id!,
          limiteAnterior: socioAtual.limite,
          limiteNovo: limite !== undefined ? parseFloat(limite) || 0 : socioAtual.limite,
          margemAnterior: socioAtual.margemConsig,
          margemNova: margemConsig !== undefined ? parseFloat(margemConsig) || 0 : socioAtual.margemConsig,
          motivo: motivo.trim(),
          observacao: observacao?.trim() || null,
        }
      })
    ])

    // Audit log
    const { ipAddress, userAgent } = getRequestInfo(request)
    await createAuditLog({
      userId: session.user.id!,
      userName: session.user.name || "Desconhecido",
      userRole: session.user.role || "USER",
      action: "UPDATE",
      module: "margem",
      entityId: socioId,
      entityName: socioAtual.nome,
      description: `Margem alterada para ${socioAtual.nome}: Limite ${socioAtual.limite || 0} → ${socioAtualizado.limite}, Margem ${socioAtual.margemConsig || 0} → ${socioAtualizado.margemConsig}`,
      metadata: {
        limiteAnterior: socioAtual.limite?.toString() || "0",
        limiteNovo: socioAtualizado.limite?.toString(),
        margemAnterior: socioAtual.margemConsig?.toString() || "0",
        margemNova: socioAtualizado.margemConsig?.toString(),
        motivo: motivo.trim(),
      },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ socio: socioAtualizado, historico })
  } catch (error) {
    console.error("Erro ao atualizar margem:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

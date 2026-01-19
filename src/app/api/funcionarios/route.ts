import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const empresaId = searchParams.get("empresaId")
    const ativo = searchParams.get("ativo")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Construir filtros base
    const where: any = {
      AND: []
    }

    // MANAGER/ADMIN pode ver todos os funcionários, outros roles apenas os seus
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      where.AND.push({ userId: session.user.id })
    }

    // Filtro de busca por nome, CPF ou matrícula
    let useExactMatch = false
    if (search) {
      const cpfNumbers = search.replace(/\D/g, "")
      const isOnlyNumbers = cpfNumbers === search
      
      // Se for apenas números, tentar busca exata de matrícula primeiro
      if (isOnlyNumbers) {
        const exactMatch = await prisma.socio.findFirst({
          where: {
            matricula: search,
            ...(session.user.role !== "MANAGER" && session.user.role !== "ADMIN" 
              ? { userId: session.user.id } 
              : {}),
            ...(empresaId ? { empresaId: parseInt(empresaId) } : {})
          }
        })
        
        if (exactMatch) {
          // Se encontrou matrícula exata, usar apenas esse filtro
          useExactMatch = true
          where.AND.push({ matricula: { equals: search } })
        }
      }
      
      // Se não encontrou matrícula exata, fazer busca ampla
      if (!useExactMatch) {
        const searchFilters: any[] = [
          { nome: { contains: search, mode: "insensitive" } },
          { matricula: { contains: search, mode: "insensitive" } },
        ]
        
        // Só adiciona filtro de CPF se houver números no termo de busca
        if (cpfNumbers.length > 0) {
          searchFilters.push({ cpf: { contains: cpfNumbers, mode: "insensitive" } })
        }
        
        where.AND.push({ OR: searchFilters })
      }
    }

    // Filtro por empresa
    if (empresaId) {
      where.AND.push({ empresaId: parseInt(empresaId) })
    }

    // Filtro por status (ativo/inativo)
    if (ativo !== null && ativo !== undefined) {
      where.AND.push({ ativo: ativo === 'true' })
    }

    // Se não há filtros, remover a estrutura AND vazia
    const finalWhere = where.AND.length > 0 ? where : {}

    console.log("Search params:", { search, empresaId, role: session.user.role, useExactMatch, page, limit })

    // Buscar total de registros para paginação
    const total = await prisma.socio.count({ where: finalWhere })

    // Buscar funcionários com paginação e apenas campos necessários
    const funcionarios = await prisma.socio.findMany({
      where: finalWhere,
      select: {
        id: true,
        nome: true,
        cpf: true,
        matricula: true,
        empresaId: true,
        empresa: {
          select: {
            id: true,
            nome: true,
          },
        },
        limite: true,
        margemConsig: true,
        ativo: true,
      },
      orderBy: { nome: "asc" },
      skip,
      take: limit,
    })

    return NextResponse.json({
      data: funcionarios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erro ao buscar funcionários:", error)
    return NextResponse.json(
      { error: "Erro ao buscar funcionários" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const data = await request.json()

    const funcionario = await prisma.socio.create({
      data: {
        userId: session.user.role === "MANAGER" || session.user.role === "ADMIN" ? null : session.user.id,
        empresaId: parseInt(data.empresaId),
        nome: data.nome,
        cpf: data.cpf?.replace(/\D/g, "") || null,
        rg: data.rg || null,
        matricula: data.matricula || null,
        funcao: data.funcao || null,
        lotacao: data.lotacao || null,
        endereco: data.endereco || null,
        bairro: data.bairro || null,
        cep: data.cep || null,
        cidade: data.cidade || null,
        telefone: data.telefone || null,
        celular: data.celular || null,
        email: data.email || null,
        contato: data.contato || null,
        dataCadastro: data.dataCadastro ? new Date(data.dataCadastro) : null,
        dataAdmissao: data.dataAdmissao ? new Date(data.dataAdmissao) : null,
        dataNascimento: data.dataNascimento ? new Date(data.dataNascimento) : null,
        limite: data.limite ? parseFloat(data.limite) : null,
        margemConsig: data.margemConsig ? parseFloat(data.margemConsig) : null,
        gratificacao: data.gratificacao ? parseFloat(data.gratificacao) : null,
        devolucao: data.devolucao && !isNaN(parseFloat(data.devolucao)) ? parseFloat(data.devolucao) : null,
        autorizado: data.autorizado || null,
        sexo: data.sexo || null,
        estadoCivil: data.estadoCivil || null,
        numCompras: data.numCompras ? parseInt(data.numCompras) : null,
        tipo: data.tipo || null,
        agencia: data.agencia || null,
        conta: data.conta || null,
        banco: data.banco || null,
        bloqueio: data.bloqueio || null,
        motivoBloqueio: data.motivoBloqueio || null,
        codTipo: data.codTipo && !isNaN(parseInt(data.codTipo)) ? parseInt(data.codTipo) : null,
        senha: data.senha || null,
        dataExclusao: data.dataExclusao ? new Date(data.dataExclusao) : null,
        motivoExclusao: data.motivoExclusao || null,
        ativo: data.ativo !== undefined ? data.ativo : true,
      },
      include: {
        empresa: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    })

    return NextResponse.json(funcionario, { status: 201 })
  } catch (error: any) {
    console.error("Erro ao criar funcionário:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao criar funcionário" },
      { status: 500 }
    )
  }
}

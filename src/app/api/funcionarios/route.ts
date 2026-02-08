import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog, getRequestInfo } from "@/lib/audit-log"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const empresaId = searchParams.get("empresaId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Construir filtros base
    const where: any = {
      AND: []
    }

    // MANAGER/ADMIN pode ver todos os funcionários
    // Usuários subordinados veem os dados do MANAGER que os criou
    // Outros roles veem apenas os seus próprios dados
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      const targetUserId = session.user.id
      where.AND.push({ userId: targetUserId })
    }

    // Detectar se a busca é por status
    let statusFilter: boolean | null = null
    const searchLower = search.toLowerCase().trim()
    
    if (searchLower === 'ativo' || searchLower === 'ativos') {
      statusFilter = true
    } else if (searchLower === 'inativo' || searchLower === 'inativos') {
      statusFilter = false
    }

    // Filtro de busca por nome, CPF, matrícula ou status
    let useExactMatch = false
    if (search && statusFilter === null) {
      const cpfNumbers = search.replace(/\D/g, "")
      const isOnlyNumbers = cpfNumbers === search
      
      // Se for apenas números, tentar busca exata de matrícula primeiro
      if (isOnlyNumbers) {
        const targetUserId = session.user.role !== "MANAGER" && session.user.role !== "ADMIN"
          ? (session.user.id)
          : undefined
        
        const exactMatch = await prisma.socio.findFirst({
          where: {
            matricula: search,
            ...(targetUserId ? { userId: targetUserId } : {}),
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

    // Filtro por status se detectado na busca (baseado em dataExclusao)
    if (statusFilter !== null) {
      if (statusFilter === true) {
        // Ativo: dataExclusao null, bloqueio não é "Bloqueado", motivoBloqueio vazio, motivoExclusao vazio
        where.AND.push({
          dataExclusao: null,
          OR: [
            { bloqueio: null },
            { bloqueio: { not: "Bloqueado" } }
          ],
          motivoBloqueio: null,
          motivoExclusao: null
        })
      } else {
        // Inativo: dataExclusao preenchida OU bloqueio = "Bloqueado" OU motivoBloqueio preenchido OU motivoExclusao preenchido
        where.AND.push({
          OR: [
            { dataExclusao: { not: null } },
            { bloqueio: "Bloqueado" },
            { motivoBloqueio: { not: null } },
            { motivoExclusao: { not: null } }
          ]
        })
      }
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
        dataExclusao: true,
        bloqueio: true,
        motivoBloqueio: true,
        motivoExclusao: true,
      },
      orderBy: { nome: "asc" },
      skip,
      take: limit,
    })

    // Ajustar status baseado em dataExclusao, bloqueio, motivoBloqueio ou motivoExclusao
    const funcionariosAjustados = funcionarios.map(func => ({
      ...func,
      ativo: !func.dataExclusao && func.bloqueio !== "Bloqueado" && !func.motivoBloqueio && !func.motivoExclusao
    }))

    return NextResponse.json({
      data: funcionariosAjustados,
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

    // Determina o userId correto: para subordinados, usa o MANAGER que os criou
    const targetUserId = session.user.role === "MANAGER" || session.user.role === "ADMIN" 
      ? null 
      : (session.user.id)

    const funcionario = await prisma.socio.create({
      data: {
        userId: targetUserId,
        empresaId: data.empresaId && data.empresaId !== "0" ? parseInt(data.empresaId) : null,
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
        uf: data.uf || null,
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

    // Registrar log de auditoria
    const { ipAddress, userAgent } = getRequestInfo(request)
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "CREATE",
      module: "funcionarios",
      entityId: funcionario.id.toString(),
      entityName: funcionario.nome,
      description: `Funcionário "${funcionario.nome}" criado`,
      metadata: {
        empresaId: funcionario.empresaId,
        cpf: funcionario.cpf,
        matricula: funcionario.matricula,
      },
      ipAddress,
      userAgent,
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

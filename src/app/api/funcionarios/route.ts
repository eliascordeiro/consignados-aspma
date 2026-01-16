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

    // MANAGER pode ver todos os funcionários, outros roles apenas os seus
    const where: any = session.user.role === "MANAGER" || session.user.role === "ADMIN"
      ? {}
      : { userId: session.user.id }

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { cpf: { contains: search.replace(/\D/g, ""), mode: "insensitive" } },
        { matricula: { contains: search, mode: "insensitive" } },
      ]
    }

    if (empresaId) {
      where.empresaId = parseInt(empresaId)
    }

    const funcionarios = await prisma.socio.findMany({
      where,
      include: {
        empresa: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: { nome: "asc" },
    })

    return NextResponse.json(funcionarios)
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
        codTipo: data.codTipo || null,
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

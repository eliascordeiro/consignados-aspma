import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // MANAGER e ADMIN podem ver todos os funcionários
    const where: any = { id }
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      where.userId = session.user.id
    }

    const funcionario = await prisma.socio.findFirst({
      where,
      include: {
        empresa: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    })

    if (!funcionario) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(funcionario)
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao buscar funcionário" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const data = await request.json()
    const { id } = await params

    // MANAGER e ADMIN podem editar todos os funcionários
    const where: any = { id }
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      where.userId = session.user.id
    }

    // Preparar dados removendo undefined e NaN
    const updateData: any = {
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
      sexo: data.sexo || null,
      estadoCivil: data.estadoCivil || null,
      tipo: data.tipo || null,
      agencia: data.agencia || null,
      conta: data.conta || null,
      banco: data.banco || null,
      motivoBloqueio: data.motivoBloqueio || null,
      senha: data.senha || null,
      dataExclusao: data.dataExclusao ? new Date(data.dataExclusao) : null,
      motivoExclusao: data.motivoExclusao || null,
      ativo: data.ativo !== undefined ? data.ativo : true,
      bloqueio: data.bloqueio || null,
      autorizado: data.autorizado || null,
    }

    // Adicionar devolucao se for número válido
    if (data.devolucao && !isNaN(parseFloat(data.devolucao))) {
      updateData.devolucao = parseFloat(data.devolucao)
    }

    // Adicionar campos numéricos apenas se forem válidos
    if (data.limite && !isNaN(parseFloat(data.limite))) {
      updateData.limite = parseFloat(data.limite)
    }
    if (data.margemConsig && !isNaN(parseFloat(data.margemConsig))) {
      updateData.margemConsig = parseFloat(data.margemConsig)
    }
    if (data.gratificacao && !isNaN(parseFloat(data.gratificacao))) {
      updateData.gratificacao = parseFloat(data.gratificacao)
    }
    if (data.numCompras && !isNaN(parseInt(data.numCompras))) {
      updateData.numCompras = parseInt(data.numCompras)
    }

    // codTipo é Int no schema
    if (data.codTipo && !isNaN(parseInt(data.codTipo))) {
      updateData.codTipo = parseInt(data.codTipo)
    }

    // Adicionar relacionamento empresa apenas se existir empresaId válido
    if (data.empresaId && data.empresaId !== "" && !isNaN(parseInt(data.empresaId))) {
      updateData.empresa = {
        connect: { id: parseInt(data.empresaId) }
      }
    }

    const funcionario = await prisma.socio.update({
      where,
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Erro ao atualizar funcionário:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar funcionário" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // MANAGER e ADMIN podem deletar todos os funcionários
    const where: any = { id }
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      where.userId = session.user.id
    }

    await prisma.socio.delete({
      where,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao excluir funcionário" },
      { status: 500 }
    )
  }
}

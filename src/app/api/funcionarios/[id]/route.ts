import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog, getRequestInfo } from "@/lib/audit-log"

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
    // Usuários subordinados podem ver funcionários do MANAGER que os criou
    const where: any = { id }
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      const targetUserId = session.user.id
      where.userId = targetUserId
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
    // Usuários subordinados podem editar funcionários do MANAGER que os criou
    const where: any = { id }
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      const targetUserId = session.user.id
      where.userId = targetUserId
    }

    // Preparar dados removendo undefined e NaN
    const updateData: any = {
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

    // Registrar log de auditoria
    const { ipAddress, userAgent } = getRequestInfo(request)
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "UPDATE",
      module: "funcionarios",
      entityId: id,
      entityName: funcionario.nome,
      description: `Funcionário "${funcionario.nome}" atualizado`,
      metadata: {
        changes: Object.keys(updateData).filter(k => k !== 'empresa'),
      },
      ipAddress,
      userAgent,
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

    // Buscar funcionario antes de deletar para pegar o nome
    const funcionario = await prisma.socio.findFirst({ where })
    if (!funcionario) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 }
      )
    }

    await prisma.socio.delete({
      where,
    })

    // Registrar log de auditoria
    const { ipAddress, userAgent } = getRequestInfo(request)
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name,
      userRole: session.user.role,
      action: "DELETE",
      module: "funcionarios",
      entityId: id,
      entityName: funcionario.nome,
      description: `Funcionário "${funcionario.nome}" excluído`,
      metadata: {
        cpf: funcionario.cpf,
        matricula: funcionario.matricula,
      },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao excluir funcionário" },
      { status: 500 }
    )
  }
}

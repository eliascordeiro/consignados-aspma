import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    console.log("🔐 Reset de senha solicitado")
    console.log("   Token recebido:", token?.substring(0, 10) + "...")

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token e senha são obrigatórios" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter no mínimo 6 caracteres" },
        { status: 400 }
      )
    }

    // Buscar usuário pelo token
    const user = await prisma.users.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    })

    if (user) {
      console.log("   Usuário encontrado:", `${user.name} (${user.email})`)
      const hashedPassword = await bcrypt.hash(password, 10)
      await prisma.users.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          active: true, // conclusão do link de acesso sempre reativa a conta
          resetToken: null,
          resetTokenExpiry: null,
          passwordChangedAt: new Date(),
        },
      })
      console.log("   ✅ Senha do usuário atualizada com sucesso!")
      return NextResponse.json({ message: "Senha redefinida com sucesso!" })
    }

    // Buscar convênio pelo token
    const convenio = await prisma.convenio.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    })

    if (convenio) {
      console.log("   Convênio encontrado:", `${convenio.razao_soc} (id:${convenio.id})`)

      // Atualizar senha no convênio (plaintext — padrão existente)
      await prisma.convenio.update({
        where: { id: convenio.id },
        data: {
          senha: password,
          resetToken: null,
          resetTokenExpiry: null,
          senhaChangedAt: new Date(),
        },
      })

      // Sincroniza a senha (bcrypt) e reativa a conta de login vinculada.
      // Prioriza o vínculo por userId (convênios de acesso por e-mail, cujo
      // users.name é a razão social e não bate com convenio.usuario). Faz
      // fallback pelo nome legado (convenio.usuario) quando não houver userId.
      const hashedPassword = await bcrypt.hash(password, 10)
      let linkedUser = convenio.userId
        ? await prisma.users.findUnique({
            where: { id: convenio.userId },
            select: { id: true, role: true },
          })
        : null

      if (!linkedUser && convenio.usuario) {
        linkedUser = await prisma.users.findFirst({
          where: { name: { equals: convenio.usuario, mode: 'insensitive' } },
          select: { id: true, role: true },
        })
      }

      if (linkedUser && linkedUser.role !== 'ADMIN' && linkedUser.role !== 'MANAGER') {
        await prisma.users.update({
          where: { id: linkedUser.id },
          data: { password: hashedPassword, active: true, passwordChangedAt: new Date() },
        })
      }

      console.log("   ✅ Senha do convênio atualizada com sucesso!")
      return NextResponse.json({ message: "Senha redefinida com sucesso!" })
    }

    // Buscar empresa (consignatária) pelo token
    const empresa = await prisma.empresa.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    })

    if (empresa) {
      console.log("   Empresa encontrada:", `${empresa.nome} (id:${empresa.id})`)
      await prisma.empresa.update({
        where: { id: empresa.id },
        data: {
          senha: password,
          resetToken: null,
          resetTokenExpiry: null,
          senhaChangedAt: new Date(),
        },
      })
      console.log("   ✅ Senha da empresa atualizada com sucesso!")
      return NextResponse.json({ message: "Senha redefinida com sucesso!" })
    }

    console.log("   ❌ Token inválido ou expirado")
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Erro ao redefinir senha:", error)
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    )
  }
}

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

      // Se houver usuário vinculado pelo nome, atualiza também com bcrypt
      if (convenio.usuario) {
        const linkedUser = await prisma.users.findFirst({
          where: { name: { equals: convenio.usuario, mode: 'insensitive' } },
          select: { id: true, role: true },
        })
        if (linkedUser && linkedUser.role !== 'ADMIN' && linkedUser.role !== 'MANAGER') {
          const hashedPassword = await bcrypt.hash(password, 10)
          await prisma.users.update({
            where: { id: linkedUser.id },
            data: { password: hashedPassword, passwordChangedAt: new Date() },
          })
        }
      }

      console.log("   ✅ Senha do convênio atualizada com sucesso!")
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

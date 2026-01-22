import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔧 Adicionando permissões de logs aos MANAGER e ADMIN...")

  // Buscar todos os usuários MANAGER e ADMIN
  const users = await prisma.users.findMany({
    where: {
      OR: [
        { role: "MANAGER" },
        { role: "ADMIN" }
      ]
    }
  })

  console.log(`📋 Encontrados ${users.length} usuários para atualizar`)

  const logsPermissions = ["logs.view", "logs.export"]

  for (const user of users) {
    const currentPermissions = user.permissions || []
    const newPermissions = Array.from(new Set([...currentPermissions, ...logsPermissions]))

    if (newPermissions.length > currentPermissions.length) {
      await prisma.users.update({
        where: { id: user.id },
        data: { permissions: newPermissions }
      })
      
      console.log(`✅ ${user.email} (${user.role}): ${currentPermissions.length} → ${newPermissions.length} permissões`)
    } else {
      console.log(`⏭️  ${user.email} (${user.role}): já possui permissões de logs`)
    }
  }

  console.log("\n✨ Concluído!")
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

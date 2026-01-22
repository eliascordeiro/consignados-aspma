import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Script para sincronizar permissões de usuários subordinados com seus MANAGERS
 * Remove permissões dos subordinados que o MANAGER não possui mais
 */
async function syncSubordinatePermissions(managerId?: string) {
  console.log("🔄 Sincronizando permissões de usuários subordinados...")

  // Buscar todos os MANAGERS ou um específico
  const managers = await prisma.users.findMany({
    where: managerId ? { id: managerId, role: "MANAGER" } : { role: "MANAGER" },
    select: {
      id: true,
      name: true,
      email: true,
      permissions: true,
    }
  })

  console.log(`📋 Encontrados ${managers.length} MANAGER(s) para processar\n`)

  let totalUpdated = 0

  for (const manager of managers) {
    console.log(`\n👤 MANAGER: ${manager.name} (${manager.email})`)
    console.log(`   Permissões: ${manager.permissions?.length || 0}`)

    // Buscar usuários subordinados deste MANAGER
    const subordinates = await prisma.users.findMany({
      where: {
        createdById: manager.id,
        role: "USER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        permissions: true,
      }
    })

    if (subordinates.length === 0) {
      console.log(`   ℹ️  Nenhum usuário subordinado`)
      continue
    }

    console.log(`   📌 ${subordinates.length} usuário(s) subordinado(s):\n`)

    const managerPermissions = manager.permissions || []

    for (const subordinate of subordinates) {
      const subordinatePermissions = subordinate.permissions || []
      
      // Manter apenas permissões que o MANAGER ainda tem
      const updatedPermissions = subordinatePermissions.filter(p => 
        managerPermissions.includes(p)
      )

      const removedCount = subordinatePermissions.length - updatedPermissions.length

      if (removedCount > 0) {
        await prisma.users.update({
          where: { id: subordinate.id },
          data: { permissions: updatedPermissions }
        })

        const removedPermissions = subordinatePermissions.filter(p => 
          !managerPermissions.includes(p)
        )

        console.log(`      ✅ ${subordinate.name} (${subordinate.email})`)
        console.log(`         Removidas ${removedCount} permissão(ões): ${removedPermissions.join(", ")}`)
        console.log(`         Antes: ${subordinatePermissions.length} → Depois: ${updatedPermissions.length}`)
        
        totalUpdated++
      } else {
        console.log(`      ⏭️  ${subordinate.name} - já sincronizado (${subordinatePermissions.length} permissões)`)
      }
    }
  }

  console.log(`\n\n✨ Concluído! ${totalUpdated} usuário(s) atualizado(s)`)
}

// Executar
const managerId = process.argv[2] // ID opcional do MANAGER

main()
  .catch((e) => {
    console.error("❌ Erro:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

async function main() {
  if (managerId) {
    console.log(`🎯 Sincronizando apenas MANAGER: ${managerId}\n`)
  }
  await syncSubordinatePermissions(managerId)
}

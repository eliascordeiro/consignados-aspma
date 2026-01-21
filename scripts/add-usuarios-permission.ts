import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addUsuariosPermission() {
  try {
    console.log('🔍 Atualizando permissões do MANAGER...\n')

    // Buscar todos os usuários MANAGER
    const managers = await prisma.users.findMany({
      where: {
        role: 'MANAGER'
      }
    })

    if (managers.length === 0) {
      console.log('❌ Nenhum usuário MANAGER encontrado!')
      return
    }

    console.log(`✅ Encontrado(s) ${managers.length} usuário(s) MANAGER:\n`)

    for (const manager of managers) {
      console.log(`📝 ${manager.name} (${manager.email})`)
      console.log(`   Permissões atuais: ${manager.permissions?.length || 0}`)
      
      // Obter permissões atuais
      const currentPermissions = manager.permissions || []
      
      // Adicionar permissões de usuários se não existirem
      const newPermissions = [
        'usuarios.view',
        'usuarios.create',
        'usuarios.edit',
        'usuarios.delete'
      ]

      // Filtrar apenas as que ainda não existem
      const permissionsToAdd = newPermissions.filter(p => !currentPermissions.includes(p))
      
      if (permissionsToAdd.length === 0) {
        console.log(`   ℹ️  Já possui todas as permissões de usuários`)
        continue
      }

      // Atualizar com todas as permissões
      const updatedPermissions = [...currentPermissions, ...permissionsToAdd]
      
      await prisma.users.update({
        where: { id: manager.id },
        data: {
          permissions: updatedPermissions
        }
      })

      console.log(`   ✅ Adicionadas: ${permissionsToAdd.join(', ')}`)
      console.log(`   📊 Total de permissões agora: ${updatedPermissions.length}\n`)
    }

    console.log('✅ Atualização concluída!\n')

  } catch (error) {
    console.error('❌ Erro ao atualizar permissões:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addUsuariosPermission()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function updateRailwayManagerPermissions() {
  try {
    console.log('🔍 Atualizando permissões do MANAGER no Railway...\n')

    // Buscar o usuário MANAGER
    const manager = await prisma.users.findUnique({
      where: {
        email: 'elias157508@gmail.com'
      }
    })

    if (!manager) {
      console.log('❌ Usuário MANAGER não encontrado!')
      return
    }

    console.log(`✅ MANAGER encontrado: ${manager.name} (${manager.email})`)
    console.log(`   Permissões atuais: ${manager.permissions?.length || 0}\n`)

    // Todas as permissões disponíveis no sistema
    const allPermissions = [
      // Consignatárias
      'consignatarias.view',
      'consignatarias.create',
      'consignatarias.edit',
      'consignatarias.delete',
      'consignatarias.export',
      
      // Funcionários
      'funcionarios.view',
      'funcionarios.create',
      'funcionarios.edit',
      'funcionarios.delete',
      'funcionarios.export',
      
      // Convênios
      'convenios.view',
      'convenios.create',
      'convenios.edit',
      'convenios.delete',
      'convenios.export',
      
      // Usuários
      'usuarios.view',
      'usuarios.create',
      'usuarios.edit',
      'usuarios.delete'
    ]

    // Atualizar permissões
    const updated = await prisma.users.update({
      where: { id: manager.id },
      data: {
        permissions: allPermissions
      }
    })

    console.log('✅ Permissões atualizadas com sucesso no Railway!')
    console.log(`\n📊 Total de permissões: ${allPermissions.length}`)
    console.log('\n📋 Permissões concedidas:')
    console.log('   ✓ Consignatárias (5 permissões)')
    console.log('   ✓ Funcionários (5 permissões)')
    console.log('   ✓ Convênios (5 permissões)')
    console.log('   ✓ Usuários (4 permissões)')
    console.log('\n⚠️  IMPORTANTE: Faça logout e login novamente para atualizar a sessão!\n')

  } catch (error) {
    console.error('❌ Erro ao atualizar permissões:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateRailwayManagerPermissions()

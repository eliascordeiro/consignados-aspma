import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function checkUserPermissions() {
  try {
    const email = 'eliasteste33@gmail.com'
    
    console.log(`🔍 Verificando permissões de: ${email}\n`)

    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        active: true,
      }
    })

    if (!user) {
      console.log('❌ Usuário não encontrado!')
      return
    }

    console.log('✅ Usuário encontrado:\n')
    console.log(`   Nome: ${user.name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Ativo: ${user.active}`)
    console.log(`\n📋 Permissões (${user.permissions?.length || 0}):`)
    
    if (!user.permissions || user.permissions.length === 0) {
      console.log('   ❌ NENHUMA PERMISSÃO!')
      console.log('\n⚠️  PROBLEMA IDENTIFICADO: Usuário sem permissões!')
      console.log('   Para acessar o sistema, o usuário precisa ter pelo menos 1 permissão.')
      
      // Sugerir permissões básicas
      console.log('\n💡 Permissões sugeridas para usuário básico:')
      const basicPermissions = [
        'consignatarias.view',
        'funcionarios.view',
        'convenios.view'
      ]
      
      console.log('\nDeseja adicionar permissões básicas? Execute:')
      console.log(`\nnpx tsx scripts/add-permissions-to-user.ts ${email}`)
      
    } else {
      user.permissions.forEach((perm, index) => {
        console.log(`   ${index + 1}. ${perm}`)
      })
    }

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserPermissions()

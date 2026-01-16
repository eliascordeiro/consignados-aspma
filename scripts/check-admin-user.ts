import { PrismaClient } from '@prisma/client'

// Força o uso do banco Railway
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function checkAdminUser() {
  try {
    console.log('🔍 Verificando usuário admin no Railway...\n')

    const adminUser = await prisma.user.findUnique({
      where: {
        email: 'admin@consigexpress.com'
      }
    })

    if (!adminUser) {
      console.log('❌ Usuário admin não encontrado!')
      console.log('📋 Listando todos os usuários:\n')
      
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          password: true
        }
      })

      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   Ativo: ${user.active}`)
        console.log(`   Senha (hash): ${user.password?.substring(0, 20)}...`)
        console.log('')
      })
    } else {
      console.log('✅ Usuário admin encontrado!')
      console.log(`   ID: ${adminUser.id}`)
      console.log(`   Email: ${adminUser.email}`)
      console.log(`   Nome: ${adminUser.name}`)
      console.log(`   Role: ${adminUser.role}`)
      console.log(`   Ativo: ${adminUser.active}`)
      console.log(`   Senha (hash): ${adminUser.password?.substring(0, 30)}...`)
      console.log(`   Criado em: ${adminUser.createdAt}`)
    }

  } catch (error) {
    console.error('❌ Erro ao verificar usuário admin:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAdminUser()

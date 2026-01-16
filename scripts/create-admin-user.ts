import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

// Força o uso do banco Railway
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function createAdminUser() {
  try {
    console.log('🔍 Verificando se já existe usuário ADMIN...\n')

    // Verifica se já existe um ADMIN
    const existingAdmin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN'
      }
    })

    if (existingAdmin) {
      console.log('⚠️  Já existe um usuário ADMIN:')
      console.log(`   Nome: ${existingAdmin.name}`)
      console.log(`   Email: ${existingAdmin.email}`)
      console.log(`   ID: ${existingAdmin.id}`)
      console.log('\n❌ Operação cancelada.')
      return
    }

    console.log('✅ Nenhum ADMIN encontrado. Criando...\n')

    // Hash da senha
    const hashedPassword = await bcrypt.hash('admin123', 10)

    // Cria o usuário ADMIN
    const admin = await prisma.user.create({
      data: {
        email: 'admin@consigexpress.com',
        name: 'Administrador',
        password: hashedPassword,
        role: 'ADMIN',
        active: true
      }
    })

    console.log('✅ Usuário ADMIN criado com sucesso!')
    console.log('\n📋 Dados do novo administrador:')
    console.log(`   ID: ${admin.id}`)
    console.log(`   Nome: ${admin.name}`)
    console.log(`   Email: ${admin.email}`)
    console.log(`   Role: ${admin.role}`)
    console.log(`   Senha: admin123`)
    console.log('\n🔐 IMPORTANTE: Altere a senha após o primeiro login!')

    // Lista todos os usuários
    console.log('\n\n👥 Todos os usuários no sistema:')
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true
      },
      orderBy: {
        role: 'asc'
      }
    })

    allUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Ativo: ${user.active}`)
    })

  } catch (error) {
    console.error('❌ Erro ao criar usuário ADMIN:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()

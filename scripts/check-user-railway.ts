import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function checkUser() {
  try {
    const email = process.argv[2]
    
    if (!email) {
      console.log('❌ Por favor, forneça um email')
      console.log('Uso: npx tsx scripts/check-user-railway.ts email@exemplo.com')
      return
    }

    console.log(`🔍 Buscando usuário: ${email}\n`)

    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        active: true,
        resetToken: true,
        resetTokenExpiry: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!user) {
      console.log('❌ Usuário não encontrado!')
      return
    }

    console.log('✅ Usuário encontrado:\n')
    console.log(`   ID: ${user.id}`)
    console.log(`   Nome: ${user.name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Ativo: ${user.active}`)
    console.log(`   Hash da senha: ${user.password?.substring(0, 30)}...`)
    console.log(`   Token reset: ${user.resetToken || 'Nenhum'}`)
    console.log(`   Token expira: ${user.resetTokenExpiry || 'N/A'}`)
    console.log(`   Criado em: ${user.createdAt}`)
    console.log(`   Atualizado em: ${user.updatedAt}`)

    // Testar senha se fornecida
    const testPassword = process.argv[3]
    if (testPassword) {
      console.log(`\n🔐 Testando senha fornecida...`)
      const isValid = await bcrypt.compare(testPassword, user.password)
      console.log(`   Resultado: ${isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`)
    } else {
      console.log('\n💡 Para testar uma senha, use:')
      console.log(`   npx tsx scripts/check-user-railway.ts ${email} "sua_senha"`)
    }

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUser()

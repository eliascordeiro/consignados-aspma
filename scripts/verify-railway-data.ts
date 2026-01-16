import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkRailwayData() {
  try {
    console.log('🔍 Verificando dados no Railway PostgreSQL...\n')
    
    // Buscar todas as empresas
    const empresas = await prisma.empresa.findMany({
      orderBy: { id: 'asc' }
    })

    console.log(`📊 Total de empresas: ${empresas.length}\n`)

    if (empresas.length > 0) {
      console.log('📋 Lista completa de empresas:\n')
      empresas.forEach((emp, idx) => {
        console.log(`${idx + 1}. ID: ${emp.id}`)
        console.log(`   Nome: ${emp.nome}`)
        console.log(`   CNPJ: ${emp.cnpj || 'N/A'}`)
        console.log(`   Tipo: ${emp.tipo}`)
        console.log(`   User ID: ${emp.userId}`)
        console.log(`   Ativo: ${emp.ativo}`)
        console.log('')
      })
    }

    // Verificar se existe mais de um usuário
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    })

    console.log(`\n👥 Usuários cadastrados: ${users.length}`)
    users.forEach(user => {
      console.log(`   • ${user.name} (${user.email}) - ID: ${user.id}`)
    })

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkRailwayData()

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function consultarConvenio() {
  console.log('📊 Consultando tabela convenio...\n')
  
  try {
    // Verificar estrutura da tabela
    const colunas = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'convenio' 
      ORDER BY ordinal_position
    `
    
    console.log('📋 Estrutura da tabela convenio:\n')
    colunas.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`)
    })
    
    // Consultar dados
    console.log('\n\n🏪 Dados da tabela convenio:\n')
    const convenios = await prisma.$queryRaw`
      SELECT * FROM convenio LIMIT 10
    `
    
    convenios.forEach((conv, index) => {
      console.log(`\n${index + 1}. Convênio:`)
      Object.entries(conv).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`)
      })
    })
    
    const total = await prisma.$queryRaw`SELECT COUNT(*) as total FROM convenio`
    console.log(`\n\n📊 Total de convênios: ${total[0].total}`)
    
  } catch (error) {
    if (error.message.includes('relation "convenio" does not exist')) {
      console.log('❌ A tabela "convenio" não existe no banco de dados.')
    } else {
      console.error('Erro:', error.message)
    }
  }
}

consultarConvenio()
  .finally(async () => {
    await prisma.$disconnect()
  })

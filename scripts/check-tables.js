const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkTables() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    
    console.log('📋 Tabelas no banco de dados:\n')
    tables.forEach(t => console.log(`   ✓ ${t.table_name}`))
    
    const needed = ['empresas', 'locais', 'autorizacoes', 'socios']
    const existing = tables.map(t => t.table_name)
    
    console.log('\n📊 Status das novas tabelas:\n')
    needed.forEach(table => {
      const exists = existing.includes(table)
      console.log(`   ${exists ? '✅' : '❌'} ${table}`)
    })
    
  } catch (error) {
    console.error('Erro:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkTables()

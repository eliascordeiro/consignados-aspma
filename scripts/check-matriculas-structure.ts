import { PrismaClient } from '@prisma/client'

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/consignados_dev?schema=public'
    }
  }
})

async function checkMatriculasStructure() {
  try {
    // Verificar estrutura da tabela
    const structure = await localPrisma.$queryRaw<any[]>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'matriculas'
      ORDER BY ordinal_position
    `
    
    console.log('📋 Estrutura da tabela "matriculas" no Local:')
    console.log(JSON.stringify(structure, null, 2))
    
    // Pegar uma amostra de dados
    const sample = await localPrisma.$queryRaw<any[]>`
      SELECT * FROM matriculas LIMIT 5
    `
    
    console.log('\n📝 Amostra de dados:')
    console.log(JSON.stringify(sample, null, 2))
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await localPrisma.$disconnect()
  }
}

checkMatriculasStructure()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function addUniqueToMatricula() {
  try {
    console.log('🔄 Adicionando constraint UNIQUE na matrícula...\n')

    // Adicionar unique constraint em matricula
    await prisma.$executeRawUnsafe(`
      ALTER TABLE socios 
      ADD CONSTRAINT socios_matricula_key UNIQUE (matricula)
    `)
    
    console.log('✅ Constraint UNIQUE adicionada na matrícula')
    console.log('   Cada matrícula é única no sistema\n')

    // Verificar constraints
    const constraints = await prisma.$queryRaw`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'socios'
      AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
    `
    
    console.log('📋 Constraints na tabela socios:')
    console.log(constraints)

  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Constraint já existe')
    } else {
      console.error('❌ Erro:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

addUniqueToMatricula()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function removeUniqueFromCPF() {
  try {
    console.log('🔄 Removendo constraint e índice UNIQUE do campo CPF...\n')

    // Remover constraint unique de cpf (se existir)
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE socios DROP CONSTRAINT IF EXISTS socios_cpf_key`)
      console.log('✅ Constraint socios_cpf_key removida')
    } catch (e) {
      console.log('⚠️  Constraint não encontrada')
    }

    // Remover índice único de cpf (se existir)
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS socios_cpf_key`)
      console.log('✅ Índice socios_cpf_key removido')
    } catch (e) {
      console.log('⚠️  Índice não encontrado')
    }
    
    console.log('\n✅ CPF agora permite duplicatas (múltiplas matrículas por CPF)\n')

    // Verificar constraints restantes
    const constraints = await prisma.$queryRaw`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'socios'
      AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
    `
    
    console.log('📋 Constraints restantes na tabela socios:')
    console.log(constraints)

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

removeUniqueFromCPF()

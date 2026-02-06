import { PrismaClient } from '@prisma/client'

const railway = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function main() {
  console.log('🔧 Adicionando coluna uf na tabela socios no Railway...\n')
  
  try {
    await railway.$executeRaw`ALTER TABLE "socios" ADD COLUMN IF NOT EXISTS "uf" TEXT;`
    console.log('✅ Coluna uf adicionada com sucesso!\n')
    
    // Verificar se a coluna foi criada
    const result = await railway.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'socios' AND column_name = 'uf';
    ` as any[]
    
    if (result.length > 0) {
      console.log('✅ Verificação: Coluna uf existe na tabela socios')
      console.log('   Tipo: ', result[0].data_type)
    } else {
      console.log('⚠️  Verificação: Coluna uf NÃO foi encontrada!')
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
  } finally {
    await railway.$disconnect()
  }
}

main()

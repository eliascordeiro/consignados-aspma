import { PrismaClient } from '@prisma/client'

const railway = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function main() {
  console.log('🔧 Tornando empresaId NULL na tabela socios no Railway...\n')
  
  try {
    await railway.$executeRaw`ALTER TABLE "socios" ALTER COLUMN "empresaId" DROP NOT NULL;`
    console.log('✅ Coluna empresaId agora permite NULL!\n')
    
    // Verificar
    const result = await railway.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'socios' AND column_name = 'empresaId';
    ` as any[]
    
    if (result.length > 0) {
      console.log('✅ Verificação: Coluna empresaId')
      console.log('   Tipo:', result[0].data_type)
      console.log('   Nullable:', result[0].is_nullable)
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message)
  } finally {
    await railway.$disconnect()
  }
}

main()

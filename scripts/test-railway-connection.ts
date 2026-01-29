import { PrismaClient } from '@prisma/client'

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/consignados_dev?schema=public'
    }
  }
})

const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function test() {
  try {
    console.log('🔍 Testando conexões...\n')
    
    // Testar LOCAL
    console.log('📊 LOCAL:')
    const localCount = await localPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM matriculas
    `
    console.log(`   Matrículas no Local: ${localCount[0]?.total || 0}`)
    
    const localSample = await localPrisma.$queryRaw<any[]>`
      SELECT * FROM matriculas LIMIT 3
    `
    console.log(`   Amostra:`)
    localSample.forEach(m => {
      console.log(`      ${m.matricula_antiga} → ${m.matricula_atual}`)
    })
    
    // Testar RAILWAY
    console.log('\n📊 RAILWAY:')
    const railwayCount = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM matriculas
    `
    console.log(`   Matrículas no Railway: ${railwayCount[0]?.total || 0}`)
    
    // Tentar inserir 1 registro de teste
    console.log('\n🧪 Teste de INSERT no Railway:')
    try {
      await railwayPrisma.$executeRaw`
        INSERT INTO matriculas (matricula_antiga, matricula_atual)
        VALUES (99999, 999999)
        ON CONFLICT (matricula_antiga) DO NOTHING
      `
      console.log('   ✅ INSERT funcionou!')
      
      // Verificar se foi inserido
      const check = await railwayPrisma.$queryRaw<any[]>`
        SELECT * FROM matriculas WHERE matricula_antiga = 99999
      `
      console.log(`   Registro inserido: ${check.length > 0 ? 'SIM ✅' : 'NÃO ❌'}`)
      
      // Limpar teste
      await railwayPrisma.$executeRaw`
        DELETE FROM matriculas WHERE matricula_antiga = 99999
      `
      console.log('   🧹 Registro de teste removido')
      
    } catch (error: any) {
      console.log('   ❌ INSERT falhou:', error.message)
    }
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await localPrisma.$disconnect()
    await railwayPrisma.$disconnect()
  }
}

test()

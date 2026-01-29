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

async function simpleMigration() {
  console.log('🚀 MIGRAÇÃO SIMPLES DE MATRÍCULAS\n')
  
  try {
    // 1. Buscar dados do local
    console.log('📥 Buscando matrículas do Local...')
    const matriculas = await localPrisma.$queryRaw<any[]>`
      SELECT matricula_antiga, matricula_atual
      FROM matriculas
      ORDER BY matricula_antiga
    `
    console.log(`✅ ${matriculas.length} matrículas encontradas\n`)
    
    // 2. Verificar Railway antes
    const beforeCount = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM matriculas
    `
    console.log(`📊 Railway ANTES: ${beforeCount[0]?.total || 0} registros\n`)
    
    // 3. Inserir em lotes pequenos
    console.log('📤 Inserindo no Railway...')
    const batchSize = 50
    let success = 0
    let errors = 0
    
    for (let i = 0; i < matriculas.length; i += batchSize) {
      const batch = matriculas.slice(i, i + batchSize)
      
      try {
        for (const m of batch) {
          await railwayPrisma.$executeRaw`
            INSERT INTO matriculas (matricula_antiga, matricula_atual)
            VALUES (${m.matricula_antiga}, ${m.matricula_atual})
            ON CONFLICT (matricula_antiga) DO UPDATE
            SET matricula_atual = EXCLUDED.matricula_atual
          `
          success++
        }
        
        if (success % 500 === 0) {
          console.log(`   ⏳ ${success}/${matriculas.length} inseridos...`)
        }
      } catch (error: any) {
        errors++
        console.error(`   ❌ Erro no lote ${i}: ${error.message}`)
        if (errors > 10) {
          console.error('\n⚠️  Muitos erros! Abortando...')
          break
        }
      }
    }
    
    console.log(`\n✅ Inserção concluída:`)
    console.log(`   - Sucesso: ${success}`)
    console.log(`   - Erros: ${errors}`)
    
    // 4. Verificar Railway depois
    const afterCount = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM matriculas
    `
    console.log(`\n📊 Railway DEPOIS: ${afterCount[0]?.total || 0} registros`)
    
    // 5. Amostra
    const sample = await railwayPrisma.$queryRaw<any[]>`
      SELECT * FROM matriculas LIMIT 5
    `
    console.log(`\n📝 Amostra de registros inseridos:`)
    sample.forEach(m => {
      console.log(`   ${m.matricula_antiga} → ${m.matricula_atual}`)
    })
    
  } catch (error: any) {
    console.error('❌ Erro fatal:', error.message)
  } finally {
    await localPrisma.$disconnect()
    await railwayPrisma.$disconnect()
  }
}

simpleMigration()
  .then(() => {
    console.log('\n✅ Concluído!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Falha:', error)
    process.exit(1)
  })

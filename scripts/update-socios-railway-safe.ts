import { PrismaClient } from '@prisma/client'

const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function updateSociosSeguro() {
  console.log('🚀 ATUALIZAÇÃO SEGURA DE MATRÍCULAS - RAILWAY\n')
  console.log('='.repeat(80))
  
  try {
    // 1. Verificar se há constraint UNIQUE em matricula
    console.log('\n📊 PASSO 1: Verificando constraints...')
    
    const constraints = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'socios'::regclass
        AND conname LIKE '%matricula%'
    `
    
    console.log(`   Constraints encontradas:`)
    constraints.forEach(c => {
      console.log(`   - ${c.constraint_name} (tipo: ${c.constraint_type})`)
    })
    
    const hasUniqueConstraint = constraints.some(c => c.constraint_type === 'u')
    
    if (hasUniqueConstraint) {
      console.log(`\n⚠️  ATENÇÃO: Existe constraint UNIQUE na coluna matricula!`)
      console.log(`   Será necessário remover temporariamente para atualizar.`)
      
      // Remover constraint UNIQUE temporariamente
      console.log(`\n🔧 Removendo constraint UNIQUE temporariamente...`)
      
      for (const c of constraints) {
        if (c.constraint_type === 'u') {
          try {
            await railwayPrisma.$executeRaw`
              ALTER TABLE socios DROP CONSTRAINT ${c.constraint_name}
            `
            console.log(`   ✅ Constraint ${c.constraint_name} removida`)
          } catch (error: any) {
            console.log(`   ⚠️  Erro ao remover ${c.constraint_name}: ${error.message}`)
          }
        }
      }
    }
    
    // 2. Identificar sócios para atualizar
    console.log('\n📊 PASSO 2: Identificando sócios para atualização...')
    
    const sociosParaAtualizar = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        s.id,
        s.nome,
        s.matricula as matricula_antiga,
        m.matricula_atual
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_antiga::TEXT = s.matricula
      WHERE s.matricula != m.matricula_atual::TEXT
    `
    
    console.log(`   Sócios para atualização: ${sociosParaAtualizar.length}`)
    
    if (sociosParaAtualizar.length === 0) {
      console.log('\n✅ Todos os sócios já estão atualizados!')
      return
    }
    
    // 3. Atualizar sócios
    console.log('\n📊 PASSO 3: Atualizando matrículas...')
    
    const updateResult = await railwayPrisma.$executeRaw`
      UPDATE socios s
      SET matricula = m.matricula_atual::TEXT
      FROM matriculas m
      WHERE m.matricula_antiga::TEXT = s.matricula
        AND s.matricula != m.matricula_atual::TEXT
    `
    
    console.log(`✅ ${updateResult} sócios atualizados!`)
    
    // 4. Verificar duplicatas
    console.log('\n📊 PASSO 4: Verificando duplicatas...')
    
    const duplicatas = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        matricula,
        COUNT(*) as total
      FROM socios
      WHERE matricula IS NOT NULL
      GROUP BY matricula
      HAVING COUNT(*) > 1
    `
    
    console.log(`   Matrículas duplicadas: ${duplicatas.length}`)
    
    if (duplicatas.length > 0) {
      console.log(`\n⚠️  ATENÇÃO: Encontradas ${duplicatas.length} matrículas duplicadas:`)
      duplicatas.slice(0, 10).forEach(d => {
        console.log(`   - Matrícula ${d.matricula}: ${d.total} sócios`)
      })
      
      console.log(`\n⚠️  NÃO será possível recriar constraint UNIQUE!`)
      console.log(`   Resolva as duplicatas antes de adicionar a constraint.`)
    } else {
      // Recriar constraint UNIQUE apenas se não houver duplicatas
      if (hasUniqueConstraint) {
        console.log(`\n🔧 Recriando constraint UNIQUE...`)
        try {
          await railwayPrisma.$executeRaw`
            ALTER TABLE socios 
            ADD CONSTRAINT socios_matricula_unique UNIQUE (matricula)
          `
          console.log(`   ✅ Constraint UNIQUE recriada com sucesso!`)
        } catch (error: any) {
          console.log(`   ⚠️  Erro ao recriar constraint: ${error.message}`)
        }
      }
    }
    
    // 5. Verificação final
    console.log('\n📊 PASSO 5: Verificação final...')
    
    const verification = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT s.id) as total_com_mapeamento,
        COUNT(CASE WHEN s.matricula = m.matricula_atual::TEXT THEN 1 END) as atualizados,
        COUNT(CASE WHEN s.matricula = m.matricula_antiga::TEXT THEN 1 END) as nao_atualizados
      FROM socios s
      INNER JOIN matriculas m ON (
        m.matricula_antiga::TEXT = s.matricula 
        OR m.matricula_atual::TEXT = s.matricula
      )
    `
    
    const totalMapeamento = Number(verification[0]?.total_com_mapeamento || 0)
    const atualizados = Number(verification[0]?.atualizados || 0)
    const naoAtualizados = Number(verification[0]?.nao_atualizados || 0)
    
    console.log(`\n📈 Resultado:`)
    console.log(`   Total com mapeamento: ${totalMapeamento}`)
    console.log(`   ✅ Atualizados: ${atualizados}`)
    console.log(`   ❌ Não atualizados: ${naoAtualizados}`)
    
    if (totalMapeamento > 0) {
      const taxaSucesso = (atualizados / totalMapeamento * 100).toFixed(2)
      console.log(`   🎯 Taxa de Sucesso: ${taxaSucesso}%`)
    }
    
    // 6. Amostras
    const amostras = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        s.nome,
        s.matricula as matricula_atual,
        m.matricula_antiga
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      LIMIT 10
    `
    
    console.log(`\n📝 Amostras de Sócios Atualizados:`)
    amostras.forEach(a => {
      console.log(`   ${a.nome}`)
      console.log(`      ${a.matricula_antiga} → ${a.matricula_atual}`)
    })
    
    // 7. Resumo final
    console.log('\n' + '='.repeat(80))
    console.log('📊 RESUMO FINAL')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Atualização Concluída!`)
    console.log(`\n   - Sócios atualizados: ${updateResult}`)
    console.log(`   - Taxa de sucesso: ${totalMapeamento > 0 ? ((atualizados / totalMapeamento) * 100).toFixed(2) : '0'}%`)
    console.log(`   - Matrículas duplicadas: ${duplicatas.length}`)
    
    if (duplicatas.length > 0) {
      console.log(`\n⚠️  PRÓXIMO PASSO: Resolver duplicatas antes de adicionar constraint UNIQUE`)
    } else {
      console.log(`\n✅ Sistema pronto! Todas as matrículas foram atualizadas.`)
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
    console.error('Stack:', error.stack)
    throw error
  } finally {
    await railwayPrisma.$disconnect()
  }
}

updateSociosSeguro()
  .then(() => {
    console.log('\n✅ Processo finalizado!')
    process.exit(0)
  })
  .catch(() => {
    console.error('\n❌ Processo falhou!')
    process.exit(1)
  })

import { PrismaClient } from '@prisma/client'

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/consignados_dev?schema=public'
    }
  }
})

async function verificarLocalAtualizado() {
  console.log('🔍 VERIFICAÇÃO DO POSTGRESQL LOCAL\n')
  console.log('='.repeat(80))
  
  try {
    // 1. Verificar totais
    const totais = await localPrisma.$queryRaw<any[]>`
      SELECT 
        (SELECT COUNT(*) FROM socios) as total_socios,
        (SELECT COUNT(*) FROM matriculas) as total_matriculas
    `
    
    console.log('\n📊 TOTAIS:')
    console.log(`   Sócios: ${totais[0]?.total_socios || 0}`)
    console.log(`   Matrículas: ${totais[0]?.total_matriculas || 0}`)
    
    // 2. Verificar sócios atualizados
    const atualizados = await localPrisma.$queryRaw<any[]>`
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
    
    const totalMapeamento = Number(atualizados[0]?.total_com_mapeamento || 0)
    const sociosAtualizados = Number(atualizados[0]?.atualizados || 0)
    const naoAtualizados = Number(atualizados[0]?.nao_atualizados || 0)
    
    console.log('\n✅ SÓCIOS ATUALIZADOS:')
    console.log(`   Total com mapeamento: ${totalMapeamento}`)
    console.log(`   Atualizados: ${sociosAtualizados}`)
    console.log(`   Não atualizados: ${naoAtualizados}`)
    
    if (totalMapeamento > 0) {
      const taxaSucesso = (sociosAtualizados / totalMapeamento * 100).toFixed(2)
      console.log(`   Taxa de sucesso: ${taxaSucesso}%`)
    }
    
    // 3. Verificar duplicatas
    const duplicatas = await localPrisma.$queryRaw<any[]>`
      SELECT 
        matricula,
        COUNT(*) as total
      FROM socios
      WHERE matricula IS NOT NULL
      GROUP BY matricula
      HAVING COUNT(*) > 1
    `
    
    console.log(`\n📊 DUPLICATAS: ${duplicatas.length}`)
    if (duplicatas.length > 0) {
      duplicatas.slice(0, 5).forEach(d => {
        console.log(`   - Matrícula ${d.matricula}: ${d.total} sócios`)
      })
    }
    
    // 4. Amostras
    const amostras = await localPrisma.$queryRaw<any[]>`
      SELECT 
        s.nome,
        s.matricula as matricula_atual,
        m.matricula_antiga
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      ORDER BY s.nome
      LIMIT 10
    `
    
    console.log(`\n📝 AMOSTRAS DE SÓCIOS ATUALIZADOS (${amostras.length}):`)
    amostras.forEach(a => {
      console.log(`   ${a.nome}: ${a.matricula_antiga} → ${a.matricula_atual}`)
    })
    
    // 5. Conclusão
    console.log('\n' + '='.repeat(80))
    console.log('🎯 CONCLUSÃO')
    console.log('='.repeat(80))
    
    if (sociosAtualizados >= totalMapeamento * 0.99) {
      console.log('\n✅ PostgreSQL LOCAL está ATUALIZADO!')
      console.log(`\n   - Taxa de sucesso: ${((sociosAtualizados / totalMapeamento) * 100).toFixed(2)}%`)
      console.log(`   - ${sociosAtualizados} sócios com matrículas atuais`)
      console.log(`   - ${duplicatas.length} duplicatas encontradas`)
      
      console.log('\n🚀 RECOMENDAÇÃO:')
      console.log('   1. DELETAR todos os sócios do Railway')
      console.log('   2. MIGRAR sócios do Local → Railway')
      console.log('   3. Isso mantém a consistência dos dados')
      console.log('   4. Evita problemas de duplicatas e constraints')
      
      console.log('\n📝 Comando para migração:')
      console.log('   npx tsx scripts/migrate-socios-local-to-railway.ts')
    } else {
      console.log('\n⚠️  PostgreSQL LOCAL precisa de atualização!')
      console.log('   Execute primeiro a atualização no local.')
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
  } finally {
    await localPrisma.$disconnect()
  }
}

verificarLocalAtualizado()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

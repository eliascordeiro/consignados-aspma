import { PrismaClient } from '@prisma/client'

// Conecta ao Railway PostgreSQL
const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function verifyRailwayMigration() {
  try {
    console.log('🔍 VERIFICAÇÃO DA MIGRAÇÃO NO RAILWAY\n')
    console.log('='.repeat(80))
    
    // 1. Verificar se a tabela matriculas existe
    const hasMatriculas = await railwayPrisma.$queryRaw<any[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'matriculas'
      ) as exists
    `
    
    const tabelaExiste = hasMatriculas[0]?.exists || false
    
    console.log(`\n📋 1. Tabela 'matriculas': ${tabelaExiste ? '✅ EXISTE' : '❌ NÃO EXISTE'}`)
    
    if (!tabelaExiste) {
      console.log('\n⚠️  A migração ainda não foi concluída ou falhou.')
      return
    }
    
    // 2. Contar registros na tabela matriculas
    const countMatriculas = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM matriculas
    `
    
    console.log(`\n📊 2. Total de matrículas migradas: ${countMatriculas[0]?.total || 0}`)
    
    // 3. Verificar sócios atualizados
    const sociosAtualizados = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT s.id) as total_com_mapeamento,
        COUNT(CASE WHEN s.matricula = m.matricula_atual THEN 1 END) as atualizados,
        COUNT(CASE WHEN s.matricula = m.matricula_antiga THEN 1 END) as nao_atualizados
      FROM socios s
      INNER JOIN matriculas m ON (
        m.matricula_antiga::TEXT = s.matricula 
        OR m.matricula_atual::TEXT = s.matricula
      )
    `
    
    const totalMapeamento = Number(sociosAtualizados[0]?.total_com_mapeamento || 0)
    const atualizados = Number(sociosAtualizados[0]?.atualizados || 0)
    const naoAtualizados = Number(sociosAtualizados[0]?.nao_atualizados || 0)
    
    console.log(`\n📊 3. Sócios com Mapeamento:`)
    console.log(`   Total: ${totalMapeamento}`)
    console.log(`   ✅ Atualizados: ${atualizados}`)
    console.log(`   ❌ Não atualizados: ${naoAtualizados}`)
    
    if (totalMapeamento > 0) {
      const taxaSucesso = (atualizados / totalMapeamento * 100).toFixed(2)
      console.log(`   📈 Taxa de Sucesso: ${taxaSucesso}%`)
    }
    
    // 4. Verificar impacto em vendas
    const vendasAfetadas = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(DISTINCT v.id) as vendas_afetadas
      FROM vendas v
      INNER JOIN socios s ON s.id = v."socioId"
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
    `
    
    console.log(`\n📊 4. Vendas vinculadas a sócios atualizados: ${vendasAfetadas[0]?.vendas_afetadas || 0}`)
    
    // 5. Verificar impacto em parcelas
    const parcelasAfetadas = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(DISTINCT p.id) as parcelas_afetadas
      FROM parcelas p
      INNER JOIN vendas v ON v.id = p."vendaId"
      INNER JOIN socios s ON s.id = v."socioId"
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
    `
    
    console.log(`\n📊 5. Parcelas vinculadas a sócios atualizados: ${parcelasAfetadas[0]?.parcelas_afetadas || 0}`)
    
    // 6. Amostras de sócios atualizados
    const sampleAtualizados = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        s.id,
        s.nome,
        s.matricula as matricula_atual,
        m.matricula_antiga
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      LIMIT 5
    `
    
    console.log(`\n📝 6. Amostras de Sócios Atualizados:`)
    sampleAtualizados.forEach(s => {
      console.log(`   ${s.nome}`)
      console.log(`      Antiga: ${s.matricula_antiga} → Atual: ${s.matricula_atual}`)
    })
    
    // 7. Resumo final
    console.log('\n\n' + '='.repeat(80))
    console.log('📊 RESUMO FINAL')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Migração Concluída!`)
    console.log(`\n📈 Estatísticas Gerais:`)
    console.log(`   - Matrículas migradas: ${countMatriculas[0]?.total || 0}`)
    console.log(`   - Sócios atualizados: ${atualizados}`)
    console.log(`   - Vendas afetadas: ${vendasAfetadas[0]?.vendas_afetadas || 0}`)
    console.log(`   - Parcelas afetadas: ${parcelasAfetadas[0]?.parcelas_afetadas || 0}`)
    
    if (totalMapeamento > 0) {
      const taxaSucesso = (atualizados / totalMapeamento * 100).toFixed(2)
      console.log(`\n🎯 Taxa de Sucesso: ${taxaSucesso}%`)
    }
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error)
    throw error
  } finally {
    await railwayPrisma.$disconnect()
  }
}

verifyRailwayMigration()
  .then(() => {
    console.log('\n✅ Verificação concluída!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Falha na verificação:', error)
    process.exit(1)
  })

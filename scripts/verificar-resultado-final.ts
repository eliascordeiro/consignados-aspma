import { PrismaClient } from '@prisma/client'

const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function verificarResultadoFinal() {
  console.log('🔍 VERIFICAÇÃO FINAL - RAILWAY\n')
  console.log('='.repeat(80))
  
  try {
    // Totais gerais
    const totais = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        (SELECT COUNT(*) FROM socios) as total_socios,
        (SELECT COUNT(*) FROM matriculas) as total_matriculas,
        (SELECT COUNT(*) FROM vendas) as total_vendas,
        (SELECT COUNT(*) FROM parcelas) as total_parcelas
    `
    
    console.log('\n📊 TOTAIS GERAIS:')
    console.log(`   Sócios: ${totais[0]?.total_socios || 0}`)
    console.log(`   Matrículas: ${totais[0]?.total_matriculas || 0}`)
    console.log(`   Vendas: ${totais[0]?.total_vendas || 0}`)
    console.log(`   Parcelas: ${totais[0]?.total_parcelas || 0}`)
    
    // Sócios atualizados
    const atualizados = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT s.id) as socios_atualizados
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
    `
    
    const sociosAtualizados = Number(atualizados[0]?.socios_atualizados || 0)
    const totalSocios = Number(totais[0]?.total_socios || 0)
    const percentualAtualizado = totalSocios > 0 
      ? ((sociosAtualizados / totalSocios) * 100).toFixed(2) 
      : '0.00'
    
    console.log('\n✅ SÓCIOS ATUALIZADOS:')
    console.log(`   Total com matrícula atual: ${sociosAtualizados}`)
    console.log(`   Percentual do total: ${percentualAtualizado}%`)
    
    // Vendas e parcelas vinculadas
    const vinculados = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT v.id) as vendas_vinculadas,
        COUNT(DISTINCT p.id) as parcelas_vinculadas
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      LEFT JOIN vendas v ON v."socioId" = s.id
      LEFT JOIN parcelas p ON p."vendaId" = v.id
    `
    
    console.log('\n🔗 RELACIONAMENTOS:')
    console.log(`   Vendas vinculadas: ${vinculados[0]?.vendas_vinculadas || 0}`)
    console.log(`   Parcelas vinculadas: ${vinculados[0]?.parcelas_vinculadas || 0}`)
    
    // Amostras
    const amostras = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        s.nome,
        s.matricula as matricula_atual,
        m.matricula_antiga,
        COUNT(v.id) as num_vendas
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      LEFT JOIN vendas v ON v."socioId" = s.id
      GROUP BY s.id, s.nome, s.matricula, m.matricula_antiga
      ORDER BY num_vendas DESC
      LIMIT 5
    `
    
    console.log('\n📝 AMOSTRAS (Top 5 com mais vendas):')
    amostras.forEach(a => {
      console.log(`   ${a.nome}`)
      console.log(`      Matrícula: ${a.matricula_antiga} → ${a.matricula_atual}`)
      console.log(`      Vendas: ${a.num_vendas}`)
    })
    
    // Status final
    console.log('\n' + '='.repeat(80))
    console.log('🎯 STATUS FINAL')
    console.log('='.repeat(80))
    
    const totalMatriculas = Number(totais[0]?.total_matriculas || 0)
    
    if (totalMatriculas > 0 && sociosAtualizados > 0) {
      console.log('\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!')
      console.log(`\n   - ${totalMatriculas} matrículas migradas`)
      console.log(`   - ${sociosAtualizados} sócios atualizados (${percentualAtualizado}%)`)
      console.log(`   - ${vinculados[0]?.vendas_vinculadas || 0} vendas vinculadas`)
      console.log(`   - ${vinculados[0]?.parcelas_vinculadas || 0} parcelas vinculadas`)
      console.log(`\n✅ Sistema pronto para uso em produção!`)
    } else if (totalMatriculas > 0) {
      console.log('\n⚠️  ATENÇÃO: Matrículas migradas, mas sócios ainda não atualizados!')
      console.log(`\n   Execute: npx tsx scripts/update-socios-railway.ts`)
    } else {
      console.log('\n❌ Migração não concluída. Execute os scripts na ordem:')
      console.log(`\n   1. npx tsx scripts/simple-migrate-matriculas.ts`)
      console.log(`   2. npx tsx scripts/update-socios-railway.ts`)
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
  } finally {
    await railwayPrisma.$disconnect()
  }
}

verificarResultadoFinal()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

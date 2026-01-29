import { PrismaClient } from '@prisma/client'

const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function updateSociosRailway() {
  console.log('🚀 ATUALIZAÇÃO DE MATRÍCULAS DOS SÓCIOS NO RAILWAY\n')
  console.log('='.repeat(80))
  
  try {
    // 1. Verificar estado inicial
    console.log('\n📊 PASSO 1: Verificando estado inicial...')
    
    const totalSocios = await railwayPrisma.socio.count()
    console.log(`   Total de sócios: ${totalSocios}`)
    
    const totalMatriculas = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM matriculas
    `
    console.log(`   Total de matrículas mapeadas: ${totalMatriculas[0]?.total || 0}`)
    
    // 2. Identificar sócios que serão atualizados
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
    
    console.log(`   Sócios que precisam atualização: ${sociosParaAtualizar.length}`)
    
    if (sociosParaAtualizar.length === 0) {
      console.log('\n✅ Todos os sócios já estão com matrículas atualizadas!')
      
      // Verificar quantos já estão atualizados
      const jaAtualizados = await railwayPrisma.$queryRaw<any[]>`
        SELECT COUNT(*) as total
        FROM socios s
        INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      `
      console.log(`   Sócios com matrícula atual: ${jaAtualizados[0]?.total || 0}`)
      return
    }
    
    // Mostrar amostras
    console.log(`\n📝 Amostras de sócios que serão atualizados:`)
    sociosParaAtualizar.slice(0, 5).forEach(s => {
      console.log(`   ${s.nome}`)
      console.log(`      ${s.matricula_antiga} → ${s.matricula_atual}`)
    })
    
    // 3. Executar atualização
    console.log(`\n📊 PASSO 3: Atualizando matrículas...`)
    console.log(`   ⚠️  Esta operação irá atualizar ${sociosParaAtualizar.length} sócios`)
    
    const updateResult = await railwayPrisma.$executeRaw`
      UPDATE socios s
      SET matricula = m.matricula_atual::TEXT
      FROM matriculas m
      WHERE m.matricula_antiga::TEXT = s.matricula
        AND s.matricula != m.matricula_atual::TEXT
    `
    
    console.log(`✅ ${updateResult} sócios atualizados com sucesso!`)
    
    // 4. Verificação detalhada
    console.log('\n📊 PASSO 4: Verificação pós-atualização...')
    
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
    
    console.log(`\n📈 Resultado da Atualização:`)
    console.log(`   Total de sócios com mapeamento: ${totalMapeamento}`)
    console.log(`   ✅ Sócios com matrícula ATUAL: ${atualizados}`)
    console.log(`   ❌ Sócios com matrícula ANTIGA: ${naoAtualizados}`)
    
    if (totalMapeamento > 0) {
      const taxaSucesso = (atualizados / totalMapeamento * 100).toFixed(2)
      console.log(`\n🎯 Taxa de Sucesso: ${taxaSucesso}%`)
    }
    
    // 5. Amostras de sócios atualizados
    console.log('\n📊 PASSO 5: Amostras de sócios atualizados...')
    
    const sampleAtualizados = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        s.id,
        s.nome,
        s.matricula as matricula_atual,
        m.matricula_antiga
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      LIMIT 10
    `
    
    console.log(`\n📝 Amostras de Sócios Atualizados (${sampleAtualizados.length}):`)
    sampleAtualizados.forEach(s => {
      console.log(`   ${s.nome}`)
      console.log(`      Antiga: ${s.matricula_antiga} → Atual: ${s.matricula_atual}`)
    })
    
    // 6. Verificar impacto em vendas e parcelas
    console.log('\n📊 PASSO 6: Verificando impacto em vendas e parcelas...')
    
    const impacto = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT v.id) as vendas_afetadas,
        COUNT(DISTINCT p.id) as parcelas_afetadas
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      LEFT JOIN vendas v ON v."socioId" = s.id
      LEFT JOIN parcelas p ON p."vendaId" = v.id
    `
    
    console.log(`\n📈 Impacto nos Relacionamentos:`)
    console.log(`   Vendas vinculadas aos sócios atualizados: ${impacto[0]?.vendas_afetadas || 0}`)
    console.log(`   Parcelas vinculadas aos sócios atualizados: ${impacto[0]?.parcelas_afetadas || 0}`)
    
    console.log(`\n💡 Importante:`)
    console.log(`   ✅ Vendas e parcelas se relacionam com sócios por ID (UUID)`)
    console.log(`   ✅ Elas automaticamente refletem a matrícula atualizada do sócio`)
    console.log(`   ✅ NÃO é necessário atualizar vendas e parcelas diretamente!`)
    
    // 7. Resumo final
    console.log('\n\n' + '='.repeat(80))
    console.log('📊 RESUMO FINAL DA ATUALIZAÇÃO')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Atualização Concluída com Sucesso!`)
    
    console.log(`\n📈 Estatísticas:`)
    console.log(`   - Total de sócios no Railway: ${totalSocios}`)
    console.log(`   - Matrículas disponíveis para mapeamento: ${totalMatriculas[0]?.total || 0}`)
    console.log(`   - Sócios atualizados nesta execução: ${updateResult}`)
    console.log(`   - Sócios com matrícula atual: ${atualizados}`)
    console.log(`   - Vendas afetadas: ${impacto[0]?.vendas_afetadas || 0}`)
    console.log(`   - Parcelas afetadas: ${impacto[0]?.parcelas_afetadas || 0}`)
    
    if (totalMapeamento > 0) {
      const taxaSucesso = (atualizados / totalMapeamento * 100).toFixed(2)
      console.log(`   - Taxa de sucesso: ${taxaSucesso}%`)
    }
    
    console.log(`\n🎯 Próximos Passos:`)
    console.log(`   1. ✅ Tabela 'matriculas' criada e populada no Railway`)
    console.log(`   2. ✅ Sócios atualizados com novas matrículas`)
    console.log(`   3. ✅ Vendas e parcelas automaticamente corretas (relacionamento por ID)`)
    console.log(`   4. 🔍 Testar aplicação para validar funcionamento`)
    console.log(`   5. 📊 Monitorar logs de produção`)
    
  } catch (error: any) {
    console.error('\n❌ Erro durante a atualização:', error.message)
    console.error('Stack:', error.stack)
    throw error
  } finally {
    await railwayPrisma.$disconnect()
  }
}

updateSociosRailway()
  .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Falha no processo:', error)
    process.exit(1)
  })

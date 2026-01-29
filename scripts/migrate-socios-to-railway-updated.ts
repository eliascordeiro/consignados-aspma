import { PrismaClient } from '@prisma/client'

// Conecta ao PostgreSQL Local
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/consignados_dev?schema=public'
    }
  }
})

// Conecta ao Railway PostgreSQL
const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

interface MatriculaMapping {
  matricula_antiga: number
  matricula_atual: number
}

async function migrateSociosToRailway() {
  try {
    console.log('🚀 MIGRAÇÃO DE SÓCIOS ATUALIZADOS PARA RAILWAY\n')
    console.log('='.repeat(80))
    
    // ========================================
    // PASSO 1: Criar tabela 'matriculas' no Railway
    // ========================================
    console.log('\n📋 PASSO 1: Criando tabela "matriculas" no Railway...')
    
    await railwayPrisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS matriculas (
        matricula_antiga INTEGER PRIMARY KEY,
        matricula_atual INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    await railwayPrisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_matricula_atual ON matriculas(matricula_atual)
    `
    
    console.log('✅ Tabela "matriculas" criada com sucesso!')
    
    // ========================================
    // PASSO 2: Migrar dados da tabela matriculas
    // ========================================
    console.log('\n📋 PASSO 2: Migrando tabela "matriculas" do Local para Railway...')
    
    const matriculasLocal = await localPrisma.$queryRaw<MatriculaMapping[]>`
      SELECT matricula_antiga, matricula_atual
      FROM matriculas
      ORDER BY matricula_antiga
    `
    
    console.log(`   📊 ${matriculasLocal.length} matrículas encontradas no Local`)
    
    // Limpar tabela no Railway antes de inserir
    await railwayPrisma.$executeRaw`TRUNCATE TABLE matriculas RESTART IDENTITY CASCADE`
    
    // Inserir em lotes de 100
    const batchSize = 100
    let migrated = 0
    
    for (let i = 0; i < matriculasLocal.length; i += batchSize) {
      const batch = matriculasLocal.slice(i, i + batchSize)
      
      for (const m of batch) {
        await railwayPrisma.$executeRaw`
          INSERT INTO matriculas (matricula_antiga, matricula_atual)
          VALUES (${m.matricula_antiga}, ${m.matricula_atual})
          ON CONFLICT (matricula_antiga) DO UPDATE
          SET matricula_atual = EXCLUDED.matricula_atual
        `
        migrated++
      }
      
      console.log(`   ⏳ ${migrated}/${matriculasLocal.length} matrículas migradas...`)
    }
    
    console.log(`✅ ${migrated} matrículas migradas com sucesso!`)
    
    // ========================================
    // PASSO 3: Verificar sócios que precisam ser atualizados
    // ========================================
    console.log('\n📋 PASSO 3: Identificando sócios que precisam atualização...')
    
    const sociosParaAtualizar = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        s.id,
        s.matricula as matricula_antiga,
        m.matricula_atual
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_antiga = s.matricula
      WHERE s.matricula != m.matricula_atual
    `
    
    console.log(`   📊 ${sociosParaAtualizar.length} sócios precisam ser atualizados no Railway`)
    
    if (sociosParaAtualizar.length === 0) {
      console.log('\n✅ Todos os sócios já estão com matrículas atualizadas!')
      return
    }
    
    // Mostrar amostras
    console.log(`\n📝 Amostras de sócios que serão atualizados:`)
    sociosParaAtualizar.slice(0, 5).forEach(s => {
      console.log(`   [${s.id}] ${s.matricula_antiga} → ${s.matricula_atual}`)
    })
    
    // ========================================
    // PASSO 4: Atualizar matrículas dos sócios no Railway
    // ========================================
    console.log('\n📋 PASSO 4: Atualizando matrículas dos sócios no Railway...')
    console.log(`   ⚠️  Esta operação irá atualizar ${sociosParaAtualizar.length} sócios`)
    
    const result = await railwayPrisma.$executeRaw`
      UPDATE socios s
      SET matricula = m.matricula_atual
      FROM matriculas m
      WHERE m.matricula_antiga = s.matricula
        AND s.matricula != m.matricula_atual
    `
    
    console.log(`✅ ${result} sócios atualizados com sucesso!`)
    
    // ========================================
    // PASSO 5: Verificação final
    // ========================================
    console.log('\n📋 PASSO 5: Verificação final...')
    
    const verification = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_socios,
        COUNT(CASE WHEN s.matricula = m.matricula_atual THEN 1 END) as socios_atualizados,
        COUNT(CASE WHEN s.matricula = m.matricula_antiga THEN 1 END) as socios_nao_atualizados
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_antiga = s.matricula OR m.matricula_atual = s.matricula
    `
    
    console.log(`\n📊 Resultado da Migração:`)
    console.log(`   Total de sócios com mapeamento: ${verification[0]?.total_socios || 0}`)
    console.log(`   Sócios com matrícula atualizada: ${verification[0]?.socios_atualizados || 0}`)
    console.log(`   Sócios NÃO atualizados: ${verification[0]?.socios_nao_atualizados || 0}`)
    
    // Taxa de sucesso
    const totalSocios = Number(verification[0]?.total_socios || 0)
    const atualizados = Number(verification[0]?.socios_atualizados || 0)
    const taxaSucesso = totalSocios > 0 ? (atualizados / totalSocios * 100).toFixed(2) : '0.00'
    
    console.log(`\n✅ Taxa de Sucesso: ${taxaSucesso}%`)
    
    // ========================================
    // PASSO 6: Verificar impacto em vendas e parcelas
    // ========================================
    console.log('\n📋 PASSO 6: Verificando impacto em vendas e parcelas...')
    
    const impactoVendas = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT v.id) as vendas_afetadas,
        COUNT(DISTINCT p.id) as parcelas_afetadas
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual = s.matricula
      LEFT JOIN vendas v ON v."socioId" = s.id
      LEFT JOIN parcelas p ON p."vendaId" = v.id
    `
    
    console.log(`\n📊 Impacto nos Relacionamentos:`)
    console.log(`   Vendas vinculadas aos sócios atualizados: ${impactoVendas[0]?.vendas_afetadas || 0}`)
    console.log(`   Parcelas vinculadas aos sócios atualizados: ${impactoVendas[0]?.parcelas_afetadas || 0}`)
    
    console.log(`\n💡 Nota Importante:`)
    console.log(`   ✅ Vendas e parcelas se relacionam com sócios por ID (chave estrangeira)`)
    console.log(`   ✅ Elas automaticamente refletem a matrícula atualizada do sócio`)
    console.log(`   ✅ NÃO é necessário atualizar vendas e parcelas diretamente!`)
    
    // ========================================
    // RESUMO FINAL
    // ========================================
    console.log('\n\n📊 RESUMO FINAL DA MIGRAÇÃO')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Migração Concluída com Sucesso!`)
    console.log(`\n📈 Estatísticas:`)
    console.log(`   - Matrículas migradas: ${migrated}`)
    console.log(`   - Sócios atualizados: ${result}`)
    console.log(`   - Taxa de sucesso: ${taxaSucesso}%`)
    console.log(`   - Vendas afetadas: ${impactoVendas[0]?.vendas_afetadas || 0}`)
    console.log(`   - Parcelas afetadas: ${impactoVendas[0]?.parcelas_afetadas || 0}`)
    
    console.log(`\n🎯 Próximos Passos:`)
    console.log(`   1. ✅ Tabela 'matriculas' criada no Railway`)
    console.log(`   2. ✅ Sócios atualizados com novas matrículas`)
    console.log(`   3. ✅ Vendas e parcelas automaticamente refletem as mudanças`)
    console.log(`   4. 🔍 Testar aplicação para validar funcionamento`)
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error)
    throw error
  } finally {
    await localPrisma.$disconnect()
    await railwayPrisma.$disconnect()
  }
}

migrateSociosToRailway()
  .then(() => {
    console.log('\n✅ Migração finalizada com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Falha na migração:', error)
    process.exit(1)
  })

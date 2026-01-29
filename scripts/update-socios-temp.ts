import { PrismaClient } from '@prisma/client'

const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function updateComTemporario() {
  console.log('🚀 ATUALIZAÇÃO COM VALORES TEMPORÁRIOS - RAILWAY\n')
  console.log('='.repeat(80))
  
  try {
    // 1. Estado inicial
    console.log('\n📊 PASSO 1: Verificando estado inicial...')
    
    const totalSocios = await railwayPrisma.socio.count()
    console.log(`   Total de sócios: ${totalSocios}`)
    
    const sociosParaAtualizar = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_antiga::TEXT = s.matricula
      WHERE s.matricula != m.matricula_atual::TEXT
    `
    
    console.log(`   Sócios para atualização: ${sociosParaAtualizar[0]?.total || 0}`)
    
    if (Number(sociosParaAtualizar[0]?.total || 0) === 0) {
      console.log('\n✅ Todos os sócios já estão atualizados!')
      return
    }
    
    // 2. Primeira passada - adicionar prefixo temporário "TEMP_"
    console.log('\n📊 PASSO 2: Adicionando prefixo temporário...')
    
    const step1 = await railwayPrisma.$executeRaw`
      UPDATE socios s
      SET matricula = 'TEMP_' || m.matricula_atual::TEXT
      FROM matriculas m
      WHERE m.matricula_antiga::TEXT = s.matricula
        AND s.matricula != m.matricula_atual::TEXT
        AND s.matricula NOT LIKE 'TEMP_%'
    `
    
    console.log(`✅ ${step1} sócios marcados com prefixo temporário`)
    
    // 3. Segunda passada - remover prefixo temporário
    console.log('\n📊 PASSO 3: Removendo prefixo temporário...')
    
    const step2 = await railwayPrisma.$executeRaw`
      UPDATE socios
      SET matricula = REPLACE(matricula, 'TEMP_', '')
      WHERE matricula LIKE 'TEMP_%'
    `
    
    console.log(`✅ ${step2} sócios atualizados para matrícula final`)
    
    // 4. Verificação
    console.log('\n📊 PASSO 4: Verificando resultado...')
    
    const verification = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT s.id) as total_com_mapeamento,
        COUNT(CASE WHEN s.matricula = m.matricula_atual::TEXT THEN 1 END) as atualizados,
        COUNT(CASE WHEN s.matricula = m.matricula_antiga::TEXT THEN 1 END) as nao_atualizados,
        COUNT(CASE WHEN s.matricula LIKE 'TEMP_%' THEN 1 END) as com_temp
      FROM socios s
      INNER JOIN matriculas m ON (
        m.matricula_antiga::TEXT = s.matricula 
        OR m.matricula_atual::TEXT = s.matricula
        OR REPLACE(s.matricula, 'TEMP_', '') = m.matricula_atual::TEXT
      )
    `
    
    const totalMapeamento = Number(verification[0]?.total_com_mapeamento || 0)
    const atualizados = Number(verification[0]?.atualizados || 0)
    const naoAtualizados = Number(verification[0]?.nao_atualizados || 0)
    const comTemp = Number(verification[0]?.com_temp || 0)
    
    console.log(`\n📈 Resultado:`)
    console.log(`   Total com mapeamento: ${totalMapeamento}`)
    console.log(`   ✅ Atualizados: ${atualizados}`)
    console.log(`   ❌ Não atualizados: ${naoAtualizados}`)
    console.log(`   ⏳ Com prefixo TEMP_: ${comTemp}`)
    
    if (totalMapeamento > 0) {
      const taxaSucesso = (atualizados / totalMapeamento * 100).toFixed(2)
      console.log(`   🎯 Taxa de Sucesso: ${taxaSucesso}%`)
    }
    
    // 5. Amostras
    const amostras = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        s.nome,
        s.matricula as matricula_atual,
        m.matricula_antiga
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
      ORDER BY s.nome
      LIMIT 10
    `
    
    console.log(`\n📝 Amostras de Sócios Atualizados (${amostras.length}):`)
    amostras.forEach(a => {
      console.log(`   ${a.nome}: ${a.matricula_antiga} → ${a.matricula_atual}`)
    })
    
    // 6. Verificar se ainda tem TEMP_
    if (comTemp > 0) {
      console.log(`\n⚠️  ATENÇÃO: ${comTemp} sócios ainda têm prefixo TEMP_`)
      console.log(`   Execute o script novamente para completar a atualização.`)
    }
    
    // 7. Verificar duplicatas
    const duplicatas = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        matricula,
        COUNT(*) as total
      FROM socios
      WHERE matricula IS NOT NULL
      GROUP BY matricula
      HAVING COUNT(*) > 1
    `
    
    if (duplicatas.length > 0) {
      console.log(`\n⚠️  Matrículas duplicadas encontradas: ${duplicatas.length}`)
      duplicatas.slice(0, 5).forEach(d => {
        console.log(`   - Matrícula ${d.matricula}: ${d.total} sócios`)
      })
    }
    
    // 8. Resumo final
    console.log('\n' + '='.repeat(80))
    console.log('📊 RESUMO FINAL')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Atualização Concluída!`)
    console.log(`\n   - Passo 1 (temporário): ${step1} registros`)
    console.log(`   - Passo 2 (final): ${step2} registros`)
    console.log(`   - Taxa de sucesso: ${totalMapeamento > 0 ? ((atualizados / totalMapeamento) * 100).toFixed(2) : '0'}%`)
    console.log(`   - Duplicatas: ${duplicatas.length}`)
    
    if (comTemp === 0 && naoAtualizados === 0 && duplicatas.length === 0) {
      console.log(`\n✅ SUCESSO TOTAL! Todas as matrículas foram atualizadas corretamente.`)
    } else if (comTemp > 0) {
      console.log(`\n⚠️  Execute novamente para completar (${comTemp} pendentes)`)
    }
    
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
    throw error
  } finally {
    await railwayPrisma.$disconnect()
  }
}

updateComTemporario()
  .then(() => {
    console.log('\n✅ Processo finalizado!')
    process.exit(0)
  })
  .catch(() => {
    console.error('\n❌ Processo falhou!')
    process.exit(1)
  })

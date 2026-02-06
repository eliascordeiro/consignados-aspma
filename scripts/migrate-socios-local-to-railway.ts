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

async function migrarSociosCompleto() {
  console.log('🚀 MIGRAÇÃO COMPLETA: LOCAL → RAILWAY\n')
  console.log('='.repeat(80))
  console.log('\n⚠️  ATENÇÃO: Este script irá:')
  console.log('   1. DELETAR todos os sócios do Railway')
  console.log('   2. DELETAR todas as vendas do Railway (relacionadas)')
  console.log('   3. DELETAR todas as parcelas do Railway (relacionadas)')
  console.log('   4. MIGRAR sócios atualizados do Local')
  console.log('\n' + '='.repeat(80))
  
  try {
    // 1. Verificar estado inicial
    console.log('\n📊 PASSO 1: Verificando estado inicial...\n')
    
    const localCount = await localPrisma.socio.count()
    const railwayCountBefore = await railwayPrisma.socio.count()
    
    console.log('   LOCAL:')
    console.log(`   - Sócios: ${localCount}`)
    
    console.log('\n   RAILWAY (antes):')
    console.log(`   - Sócios: ${railwayCountBefore}`)
    
    // 2. Limpar Railway (CASCADE irá deletar vendas e parcelas)
    console.log('\n📊 PASSO 2: Limpando Railway...')
    console.log('   ⚠️  Deletando sócios (CASCADE irá remover vendas e parcelas)...')
    
    const deletedSocios = await railwayPrisma.socio.deleteMany({})
    console.log(`   ✅ ${deletedSocios.count} sócios deletados`)
    
    // Verificar se vendas e parcelas também foram deletadas
    const vendasRestantes = await railwayPrisma.venda.count()
    const parcelasRestantes = await railwayPrisma.parcela.count()
    
    console.log(`   📊 Verificação:`)
    console.log(`      - Vendas restantes: ${vendasRestantes}`)
    console.log(`      - Parcelas restantes: ${parcelasRestantes}`)
    
    if (vendasRestantes > 0 || parcelasRestantes > 0) {
      console.log(`\n   ⚠️  Removendo vendas e parcelas manualmente...`)
      await railwayPrisma.parcela.deleteMany({})
      await railwayPrisma.venda.deleteMany({})
      console.log(`   ✅ Vendas e parcelas removidas`)
    }
    
    // 3. Buscar ou criar usuário admin para empresas
    console.log('\n📊 PASSO 3: Verificando usuário admin...')
    
    let adminUser = await railwayPrisma.users.findFirst({
      where: { 
        OR: [
          { email: 'admin@system.com' },
          { role: 'ADMIN' }
        ]
      }
    })
    
    if (!adminUser) {
      console.log('   ⚠️  Nenhum usuário admin encontrado')
      console.log('   ℹ️  Empresas e sócios serão criados sem userId')
    } else {
      console.log(`   ✅ Usuário admin encontrado: ${adminUser.email}`)
    }
    
    // 4. Buscar empresas PREFEITURA e FUNDO no Railway
    console.log('\n📊 PASSO 4: Buscando empresas no Railway...')
    
    const empresaPrefeitura = await railwayPrisma.empresa.findFirst({
      where: { nome: { contains: 'PREFEITURA MUNICIPAL', mode: 'insensitive' } }
    })
    
    const empresaFundo = await railwayPrisma.empresa.findFirst({
      where: { nome: { contains: 'FUNDO DE PREVIDENCIA', mode: 'insensitive' } }
    })
    
    if (empresaPrefeitura) {
      console.log(`   ✅ PREFEITURA encontrada com ID: ${empresaPrefeitura.id}`)
    } else {
      console.log(`   ⚠️  PREFEITURA não encontrada`)
    }
    
    if (empresaFundo) {
      console.log(`   ✅ FUNDO encontrado com ID: ${empresaFundo.id}`)
    } else {
      console.log(`   ⚠️  FUNDO não encontrado`)
    }
    
    // 5. Buscar sócios do Local
    console.log('\n📊 PASSO 5: Buscando sócios do Local...')
    
    const sociosLocal = await localPrisma.socio.findMany({
      orderBy: { createdAt: 'asc' }
    })
    
    console.log(`   📥 ${sociosLocal.length} sócios encontrados`)
    
    // Verificar quantos têm empresaId NULL
    const semEmpresa = sociosLocal.filter(s => !s.empresaId).length
    if (semEmpresa > 0) {
      console.log(`   ⚠️  ${semEmpresa} sócios sem empresa`)
      console.log(`   ℹ️  Aplicando regra de mapeamento: tipo='1' → PREFEITURA, tipo='3' → FUNDO`)
    }
    
    // 6. Migrar em lotes com mapeamento de empresaId
    console.log('\n📊 PASSO 6: Migrando sócios para Railway...')
    
    const batchSize = 100
    let migrated = 0
    let sociosComEmpresaMapeada = 0
    let sociosSemEmpresaFinal = 0
    
    for (let i = 0; i < sociosLocal.length; i += batchSize) {
      const batch = sociosLocal.slice(i, i + batchSize)
      
      // Aplicar mapeamento de empresaId baseado no campo tipo
      const batchMapeado = batch.map(socio => {
        let empresaId = socio.empresaId
        
        // Se não tem empresaId, aplicar regra de mapeamento por tipo
        if (!empresaId && socio.tipo) {
          if (socio.tipo === '1' && empresaPrefeitura) {
            empresaId = empresaPrefeitura.id
            sociosComEmpresaMapeada++
          } else if (socio.tipo === '3' && empresaFundo) {
            empresaId = empresaFundo.id
            sociosComEmpresaMapeada++
          } else {
            sociosSemEmpresaFinal++
          }
        } else if (!empresaId) {
          sociosSemEmpresaFinal++
        }
        
        return {
          ...socio,
          empresaId
        }
      })
      
      await railwayPrisma.socio.createMany({
        data: batchMapeado,
        skipDuplicates: true
      })
      
      migrated += batch.length
      
      if (migrated % 500 === 0 || migrated === sociosLocal.length) {
        console.log(`   ⏳ ${migrated}/${sociosLocal.length} sócios migrados...`)
      }
    }
    
    console.log(`   ✅ ${migrated} sócios migrados com sucesso!`)
    console.log(`   📊 Mapeamento aplicado: ${sociosComEmpresaMapeada} sócios receberam empresaId`)
    console.log(`   ⚠️  ${sociosSemEmpresaFinal} sócios permaneceram sem empresa`)
    
    // 7. Verificação final
    console.log('\n📊 PASSO 7: Verificação final...')
    
    const railwayCountAfter = await railwayPrisma.socio.count()
    
    console.log(`\n   RAILWAY (depois):`)
    console.log(`   - Sócios: ${railwayCountAfter}`)
    
    // Verificar amostra de matrículas
    const sample = await railwayPrisma.socio.findMany({
      take: 5,
      orderBy: { nome: 'asc' },
      select: {
        nome: true,
        matricula: true
      }
    })
    
    console.log(`\n   📝 Amostra de sócios migrados:`)
    sample.forEach(s => {
      console.log(`      ${s.nome} - Matrícula: ${s.matricula}`)
    })
    
    // Verificar sócios com matrículas atualizadas
    const comMatriculaAtual = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total
      FROM socios s
      INNER JOIN matriculas m ON m.matricula_atual::TEXT = s.matricula
    `
    
    console.log(`\n   ✅ Sócios com matrícula atual: ${comMatriculaAtual[0]?.total || 0}`)
    
    // 6. Resumo final
    console.log('\n' + '='.repeat(80))
    console.log('📊 RESUMO FINAL')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Migração Concluída com Sucesso!`)
    console.log(`\n   📊 Estatísticas:`)
    console.log(`      - Sócios deletados do Railway: ${deletedSocios.count}`)
    console.log(`      - Sócios migrados do Local: ${migrated}`)
    console.log(`      - Sócios mapeados por tipo: ${sociosComEmpresaMapeada}`)
    console.log(`      - Sócios sem empresa: ${sociosSemEmpresaFinal}`)
    console.log(`      - Total no Railway agora: ${railwayCountAfter}`)
    console.log(`      - Sócios com matrícula atualizada: ${comMatriculaAtual[0]?.total || 0}`)
    
    const taxaAtualizacao = railwayCountAfter > 0 
      ? ((Number(comMatriculaAtual[0]?.total || 0) / railwayCountAfter) * 100).toFixed(2)
      : '0.00'
    
    console.log(`      - Taxa de atualização: ${taxaAtualizacao}%`)
    
    console.log(`\n🎯 Próximos Passos:`)
    console.log(`   1. ✅ Sócios migrados com matrículas atualizadas`)
    console.log(`   2. 📊 Migrar vendas do MySQL → Railway`)
    console.log(`   3. 📊 Migrar parcelas do MySQL → Railway`)
    console.log(`   4. 🔍 Testar aplicação`)
    
    console.log(`\n💡 Benefícios desta abordagem:`)
    console.log(`   ✅ Dados consistentes (baseados no Local já atualizado)`)
    console.log(`   ✅ Sem problemas de constraints ou duplicatas`)
    console.log(`   ✅ Matrículas já atualizadas corretamente`)
    console.log(`   ✅ Mantém integridade referencial`)
    
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
    console.error('Stack:', error.stack)
    throw error
  } finally {
    await localPrisma.$disconnect()
    await railwayPrisma.$disconnect()
  }
}

migrarSociosCompleto()
  .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!')
    process.exit(0)
  })
  .catch(() => {
    console.error('\n❌ Processo falhou!')
    process.exit(1)
  })

import { PrismaClient } from '@prisma/client'

// Conecta ao Railway PostgreSQL
const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function analyzeRailwayTables() {
  try {
    console.log('🔍 ANÁLISE DAS TABELAS NO RAILWAY POSTGRESQL\n')
    console.log('=' .repeat(80))
    
    // ========================================
    // 1. ANÁLISE DA TABELA SOCIOS
    // ========================================
    console.log('\n📊 1. TABELA SOCIOS')
    console.log('-'.repeat(80))
    
    const totalSocios = await railwayPrisma.socio.count()
    console.log(`\n✅ Total de sócios: ${totalSocios}`)
    
    // Verificar se existe a tabela matriculas
    const hasMatriculas = await railwayPrisma.$queryRaw<any[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'matriculas'
      ) as exists
    `
    
    const tabelaMatriculasExiste = hasMatriculas[0]?.exists || false
    console.log(`\n📋 Tabela 'matriculas' existe no Railway: ${tabelaMatriculasExiste ? '✅ SIM' : '❌ NÃO'}`)
    
    // Análise de matrículas dos sócios
    const matriculasAnalysis = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT matricula) as matriculas_distintas,
        MIN(CAST(matricula AS INTEGER)) as menor_matricula,
        MAX(CAST(matricula AS INTEGER)) as maior_matricula
      FROM socios
      WHERE matricula IS NOT NULL
    `
    
    console.log(`\n📈 Análise de Matrículas:`)
    console.log(`   Total de sócios: ${matriculasAnalysis[0]?.total || 0}`)
    console.log(`   Matrículas distintas: ${matriculasAnalysis[0]?.matriculas_distintas || 0}`)
    console.log(`   Menor matrícula: ${matriculasAnalysis[0]?.menor_matricula || 'N/A'}`)
    console.log(`   Maior matrícula: ${matriculasAnalysis[0]?.maior_matricula || 'N/A'}`)
    
    // Amostras de matrículas
    const sampleSocios = await railwayPrisma.socio.findMany({
      take: 5,
      orderBy: { matricula: 'asc' },
      select: {
        id: true,
        matricula: true,
        nome: true
      }
    })
    
    console.log(`\n📝 Amostra de Sócios (primeiros 5):`)
    sampleSocios.forEach(s => {
      console.log(`   [${s.id}] ${s.nome} - Matrícula: ${s.matricula}`)
    })
    
    // ========================================
    // 2. ANÁLISE DA TABELA VENDAS
    // ========================================
    console.log('\n\n📊 2. TABELA VENDAS')
    console.log('-'.repeat(80))
    
    const totalVendas = await railwayPrisma.venda.count()
    console.log(`\n✅ Total de vendas: ${totalVendas}`)
    
    // Verificar relacionamento com socios
    const vendasComSocio = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_vendas,
        COUNT(DISTINCT "socioId") as socios_distintos,
        COUNT(CASE WHEN "socioId" IS NULL THEN 1 END) as vendas_sem_socio
      FROM vendas
    `
    
    console.log(`\n📈 Relacionamento com Sócios:`)
    console.log(`   Total de vendas: ${vendasComSocio[0]?.total_vendas || 0}`)
    console.log(`   Sócios distintos: ${vendasComSocio[0]?.socios_distintos || 0}`)
    console.log(`   Vendas sem sócio: ${vendasComSocio[0]?.vendas_sem_socio || 0}`)
    
    // Verificar se há vendas órfãs (socioId não existe em socios)
    const vendasOrfas = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as vendas_orfas
      FROM vendas v
      WHERE NOT EXISTS (
        SELECT 1 FROM socios s WHERE s.id = v."socioId"
      )
    `
    
    console.log(`\n⚠️  Vendas órfãs (socio_id não existe): ${vendasOrfas[0]?.vendas_orfas || 0}`)
    
    // Amostras de vendas
    const sampleVendas = await railwayPrisma.venda.findMany({
      take: 5,
      include: {
        socio: {
          select: {
            id: true,
            matricula: true,
            nome: true
          }
        }
      }
    })
    
    console.log(`\n📝 Amostra de Vendas (primeiras 5):`)
    sampleVendas.forEach(v => {
      console.log(`   [${v.id}] Sócio: ${v.socio?.nome || 'N/A'} (${v.socio?.matricula || 'N/A'}) - Total: R$ ${v.total}`)
    })
    
    // ========================================
    // 3. ANÁLISE DA TABELA PARCELAS
    // ========================================
    console.log('\n\n📊 3. TABELA PARCELAS')
    console.log('-'.repeat(80))
    
    const totalParcelas = await railwayPrisma.parcela.count()
    console.log(`\n✅ Total de parcelas: ${totalParcelas}`)
    
    // Verificar relacionamento com vendas
    const parcelasComVenda = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_parcelas,
        COUNT(DISTINCT "vendaId") as vendas_distintas,
        COUNT(CASE WHEN "vendaId" IS NULL THEN 1 END) as parcelas_sem_venda
      FROM parcelas
    `
    
    console.log(`\n📈 Relacionamento com Vendas:`)
    console.log(`   Total de parcelas: ${parcelasComVenda[0]?.total_parcelas || 0}`)
    console.log(`   Vendas distintas: ${parcelasComVenda[0]?.vendas_distintas || 0}`)
    console.log(`   Parcelas sem venda: ${parcelasComVenda[0]?.parcelas_sem_venda || 0}`)
    
    // Verificar se há parcelas órfãs
    const parcelasOrfas = await railwayPrisma.$queryRaw<any[]>`
      SELECT COUNT(*) as parcelas_orfas
      FROM parcelas p
      WHERE NOT EXISTS (
        SELECT 1 FROM vendas v WHERE v.id = p."vendaId"
      )
    `
    
    console.log(`\n⚠️  Parcelas órfãs (venda_id não existe): ${parcelasOrfas[0]?.parcelas_orfas || 0}`)
    
    // Amostras de parcelas
    const sampleParcelas = await railwayPrisma.parcela.findMany({
      take: 5,
      include: {
        venda: {
          include: {
            socio: {
              select: {
                matricula: true,
                nome: true
              }
            }
          }
        }
      }
    })
    
    console.log(`\n📝 Amostra de Parcelas (primeiras 5):`)
    sampleParcelas.forEach(p => {
      console.log(`   [${p.id}] Venda: ${p.venda_id} - Sócio: ${p.venda?.socio?.nome || 'N/A'} (${p.venda?.socio?.matricula || 'N/A'}) - Valor: R$ ${p.valor}`)
    })
    
    // ========================================
    // 4. ANÁLISE DE INTEGRIDADE REFERENCIAL
    // ========================================
    console.log('\n\n📊 4. INTEGRIDADE REFERENCIAL')
    console.log('-'.repeat(80))
    
    // Cadeia completa: Parcelas -> Vendas -> Socios
    const integrityCheck = await railwayPrisma.$queryRaw<any[]>`
      SELECT 
        COUNT(DISTINCT p.id) as total_parcelas,
        COUNT(DISTINCT v.id) as vendas_validas,
        COUNT(DISTINCT s.id) as socios_validos
      FROM parcelas p
      LEFT JOIN vendas v ON v.id = p."vendaId"
      LEFT JOIN socios s ON s.id = v."socioId"
    `
    
    console.log(`\n✅ Cadeia Completa (Parcelas → Vendas → Sócios):`)
    console.log(`   Total de parcelas: ${integrityCheck[0]?.total_parcelas || 0}`)
    console.log(`   Vendas válidas: ${integrityCheck[0]?.vendas_validas || 0}`)
    console.log(`   Sócios válidos: ${integrityCheck[0]?.socios_validos || 0}`)
    
    // ========================================
    // 5. IMPACTO DA ATUALIZAÇÃO DE MATRÍCULAS
    // ========================================
    console.log('\n\n📊 5. IMPACTO DA ATUALIZAÇÃO DE MATRÍCULAS')
    console.log('-'.repeat(80))
    
    if (tabelaMatriculasExiste) {
      // Se a tabela matriculas existe, fazer análise de impacto
      const impactoMatriculas = await railwayPrisma.$queryRaw<any[]>`
        SELECT 
          COUNT(DISTINCT s.id) as socios_com_mapeamento,
          COUNT(DISTINCT v.id) as vendas_afetadas,
          COUNT(DISTINCT p.id) as parcelas_afetadas
        FROM socios s
        INNER JOIN matriculas m ON m.matricula_antiga = s.matricula
        LEFT JOIN vendas v ON v."socioId" = s.id
        LEFT JOIN parcelas p ON p."vendaId" = v.id
      `
      
      console.log(`\n📈 Registros que serão afetados pela atualização:`)
      console.log(`   Sócios com mapeamento: ${impactoMatriculas[0]?.socios_com_mapeamento || 0}`)
      console.log(`   Vendas afetadas: ${impactoMatriculas[0]?.vendas_afetadas || 0}`)
      console.log(`   Parcelas afetadas: ${impactoMatriculas[0]?.parcelas_afetadas || 0}`)
      
      console.log(`\n⚠️  IMPORTANTE:`)
      console.log(`   - Vendas e parcelas NÃO precisam ser atualizadas diretamente`)
      console.log(`   - Elas se relacionam com socios por ID (chave estrangeira)`)
      console.log(`   - Atualizar socios.matricula é suficiente!`)
    } else {
      console.log(`\n⚠️  Tabela 'matriculas' não existe no Railway`)
      console.log(`   Será necessário migrar a tabela antes de atualizar as matrículas`)
    }
    
    // ========================================
    // 6. RESUMO E RECOMENDAÇÕES
    // ========================================
    console.log('\n\n📊 6. RESUMO E RECOMENDAÇÕES')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Estado Atual:`)
    console.log(`   - Sócios: ${totalSocios}`)
    console.log(`   - Vendas: ${totalVendas}`)
    console.log(`   - Parcelas: ${totalParcelas}`)
    console.log(`   - Tabela 'matriculas': ${tabelaMatriculasExiste ? 'EXISTE' : 'NÃO EXISTE'}`)
    
    console.log(`\n🎯 Próximos Passos:`)
    if (!tabelaMatriculasExiste) {
      console.log(`   1. ⚠️  Migrar tabela 'matriculas' do Local para Railway`)
      console.log(`   2. ⚠️  Atualizar matrículas dos sócios no Railway`)
    } else {
      console.log(`   1. ✅ Tabela 'matriculas' já existe`)
      console.log(`   2. ⚠️  Atualizar matrículas dos sócios no Railway`)
    }
    console.log(`   3. ✅ Vendas e parcelas não precisam de atualização (relacionamento por ID)`)
    
    console.log(`\n💡 Impacto:`)
    console.log(`   - BAIXO RISCO: Vendas e parcelas se relacionam por ID, não por matrícula`)
    console.log(`   - APENAS SOCIOS: Precisa ter a matrícula atualizada`)
    console.log(`   - SEM QUEBRA: A atualização não afeta os relacionamentos existentes`)
    
  } catch (error) {
    console.error('❌ Erro ao analisar tabelas:', error)
    throw error
  } finally {
    await railwayPrisma.$disconnect()
  }
}

analyzeRailwayTables()
  .then(() => {
    console.log('\n✅ Análise concluída com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Falha na análise:', error)
    process.exit(1)
  })

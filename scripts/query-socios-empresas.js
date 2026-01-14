const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Consultando Sócios e Empresas...\n')
  
  try {
    // Consulta empresas distintas na tabela socios (campo tipo)
    console.log('🏢 Empresas encontradas (via campo tipo em socios):\n')
    const empresasDistintas = await prisma.$queryRaw`
      SELECT DISTINCT tipo as id, COUNT(*) as total_socios
      FROM socios 
      GROUP BY tipo
      ORDER BY tipo
    `
    
    empresasDistintas.forEach(emp => {
      let nome = 'Desconhecida'
      if (emp.id === 1) nome = 'Prefeitura de Araucária'
      else if (emp.id === 3) nome = 'Fundo de Previdência'
      
      console.log(`   Tipo ${emp.id}: ${nome} - ${emp.total_socios} sócios`)
    })
    
    // Consulta sócios com detalhes
    console.log('\n\n👥 Listagem de Sócios (primeiros 10):\n')
    const socios = await prisma.$queryRaw`
      SELECT id, nome, cpf, matricula, tipo as empresa_id, setor, ativo
      FROM socios 
      ORDER BY tipo, nome
      LIMIT 10
    `
    
    socios.forEach((socio, index) => {
      let empresa = 'Desconhecida'
      if (socio.empresa_id === 1) empresa = 'Prefeitura de Araucária'
      else if (socio.empresa_id === 3) empresa = 'Fundo de Previdência'
      
      console.log(`\n${index + 1}. ${socio.nome}`)
      console.log(`   CPF: ${socio.cpf}`)
      console.log(`   Matrícula: ${socio.matricula || 'N/A'}`)
      console.log(`   Empresa: ${empresa} (ID: ${socio.empresa_id})`)
      console.log(`   Setor: ${socio.setor || 'N/A'}`)
      console.log(`   Ativo: ${socio.ativo ? 'Sim' : 'Não'}`)
    })
    
    // Estatísticas
    console.log('\n\n📈 Estatísticas:\n')
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_socios,
        COUNT(DISTINCT tipo) as total_empresas,
        COUNT(CASE WHEN ativo = true THEN 1 END) as socios_ativos,
        COUNT(CASE WHEN ativo = false THEN 1 END) as socios_inativos
      FROM socios
    `
    
    const stat = stats[0]
    console.log(`   Total de Sócios: ${stat.total_socios}`)
    console.log(`   Total de Empresas: ${stat.total_empresas}`)
    console.log(`   Sócios Ativos: ${stat.socios_ativos}`)
    console.log(`   Sócios Inativos: ${stat.socios_inativos}`)
    
  } catch (error) {
    if (error.message.includes('relation "socios" does not exist')) {
      console.log('❌ A tabela "socios" não existe no banco de dados.')
      console.log('\n📋 Tabelas disponíveis:')
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
      tables.forEach(t => console.log(`   - ${t.table_name}`))
    } else {
      console.error('Erro:', error.message)
      throw error
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

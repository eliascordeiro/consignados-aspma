const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Consultando tabela socios...\n')
  
  try {
    // Primeiro, verifica se a tabela existe via SQL raw
    const socios = await prisma.$queryRaw`
      SELECT * FROM socios ORDER BY tipo, nome LIMIT 20
    `
    
    console.log(`✅ Total encontrado: ${socios.length} registros\n`)
    
    if (socios.length > 0) {
      // Mostra a estrutura das colunas
      console.log('📋 Colunas disponíveis:')
      console.log(Object.keys(socios[0]).join(', '))
      console.log('\n' + '='.repeat(80) + '\n')
      
      // Mostra os dados
      socios.forEach((socio, index) => {
        console.log(`\n${index + 1}. ${socio.nome || 'N/A'}`)
        Object.entries(socio).forEach(([key, value]) => {
          if (key !== 'nome') {
            console.log(`   ${key}: ${value}`)
          }
        })
      })
      
      // Agrupa por tipo
      console.log('\n\n📊 Agrupamento por Tipo:\n')
      const porTipo = await prisma.$queryRaw`
        SELECT tipo, COUNT(*) as total 
        FROM socios 
        GROUP BY tipo 
        ORDER BY tipo
      `
      
      porTipo.forEach(grupo => {
        let empresaNome = 'Desconhecido'
        if (grupo.tipo === 1) empresaNome = 'Prefeitura de Araucária'
        else if (grupo.tipo === 3) empresaNome = 'Fundo de Previdência'
        
        console.log(`   Tipo ${grupo.tipo} (${empresaNome}): ${grupo.total} sócios`)
      })
      
    } else {
      console.log('⚠️  Nenhum registro encontrado na tabela socios')
    }
    
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
      throw error
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkConsignatariasTable() {
  try {
    console.log('🔍 Verificando se existe tabela "consignatarias" no banco de dados...\n')

    // Tentar consultar a tabela consignatarias diretamente via SQL
    const result = await prisma.$queryRaw<any[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'consignatarias'
    `

    if (result.length > 0) {
      console.log('✅ Tabela "consignatarias" encontrada!\n')
      
      // Verificar estrutura da tabela
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'consignatarias'
        ORDER BY ordinal_position
      `

      console.log('📋 Estrutura da tabela "consignatarias":')
      console.log('─'.repeat(60))
      columns.forEach(col => {
        console.log(`  ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(15)} | ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`)
      })
      console.log('─'.repeat(60))

      // Verificar quantidade de registros
      const count = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as total FROM consignatarias
      `
      console.log(`\n📊 Total de registros: ${count[0].total}`)

      if (count[0].total > 0) {
        // Mostrar alguns registros de exemplo
        const sample = await prisma.$queryRaw<any[]>`
          SELECT * FROM consignatarias LIMIT 5
        `
        console.log('\n📄 Primeiros 5 registros:')
        console.log(JSON.stringify(sample, null, 2))
      }

    } else {
      console.log('❌ Tabela "consignatarias" NÃO encontrada no banco de dados.')
      console.log('ℹ️  O sistema está usando a tabela "empresas" para consignatárias.')
    }

    // Verificar tabela empresas
    console.log('\n\n🔍 Verificando tabela "empresas"...\n')
    const empresasCount = await prisma.empresa.count()
    console.log(`📊 Total de registros em "empresas": ${empresasCount}`)

    if (empresasCount > 0) {
      const empresas = await prisma.empresa.findMany({ take: 3 })
      console.log('\n📄 Primeiras 3 empresas cadastradas:')
      empresas.forEach(emp => {
        console.log(`  • ${emp.nome} - CNPJ: ${emp.cnpj || 'N/A'}`)
      })
    }

  } catch (error) {
    console.error('❌ Erro ao verificar tabelas:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkConsignatariasTable()

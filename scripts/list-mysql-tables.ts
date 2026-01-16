import mysql from 'mysql2/promise'

async function listTables() {
  const connection = await mysql.createConnection({
    host: '200.98.112.240',
    port: 3306,
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
  })

  try {
    console.log('🔍 Listando tabelas do MySQL...\n')
    
    const [tables] = await connection.execute('SHOW TABLES')
    console.log('Tabelas encontradas:')
    console.log(tables)

    console.log('\n📊 Verificando estrutura das principais tabelas...\n')
    
    // Tentar diferentes nomes de tabelas
    const possibleTables = ['socios', 'Socios', 'SOCIOS', 'convenio', 'Convenio', 'consignatarias', 'Consignatarias']
    
    for (const tableName of possibleTables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``)
        const total = (rows as any)[0].total
        console.log(`✓ ${tableName}: ${total} registros`)
        
        // Mostrar estrutura
        const [columns] = await connection.execute(`SHOW COLUMNS FROM \`${tableName}\``)
        console.log(`  Colunas:`, (columns as any[]).map(c => c.Field).join(', '))
      } catch (error: any) {
        // Tabela não existe, ignorar
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await connection.end()
  }
}

listTables()

import mysql from 'mysql2/promise'

async function checkMySQLConsignatarias() {
  let connection

  try {
    console.log('🔍 Conectando ao banco MySQL...\n')
    
    connection = await mysql.createConnection({
      host: '200.98.112.240',
      port: 3306,
      user: 'eliascordeiro',
      password: 'D24m0733@!',
      database: 'aspma',
      charset: 'utf8mb4'
    })

    console.log('✅ Conectado com sucesso!\n')

    // Listar todas as tabelas
    console.log('📋 Tabelas disponíveis no banco "aspma":')
    console.log('─'.repeat(60))
    const [tables] = await connection.query('SHOW TABLES')
    tables.forEach((table: any) => {
      const tableName = Object.values(table)[0]
      console.log(`  • ${tableName}`)
    })
    console.log('─'.repeat(60))

    // Verificar se existe tabela consignatarias
    const [consignatariasExists] = await connection.query(
      "SHOW TABLES LIKE 'consignatarias'"
    )

    if (Array.isArray(consignatariasExists) && consignatariasExists.length > 0) {
      console.log('\n✅ Tabela "consignatarias" encontrada!\n')

      // Estrutura da tabela
      const [columns] = await connection.query(
        'DESCRIBE consignatarias'
      )
      console.log('📊 Estrutura da tabela "consignatarias":')
      console.log('─'.repeat(80))
      console.log('Campo'.padEnd(25) + 'Tipo'.padEnd(20) + 'Null'.padEnd(10) + 'Key'.padEnd(10) + 'Default')
      console.log('─'.repeat(80))
      ;(columns as any[]).forEach((col: any) => {
        console.log(
          col.Field.padEnd(25) +
          col.Type.padEnd(20) +
          col.Null.padEnd(10) +
          (col.Key || '').padEnd(10) +
          (col.Default || '')
        )
      })
      console.log('─'.repeat(80))

      // Contar registros
      const [countResult] = await connection.query(
        'SELECT COUNT(*) as total FROM consignatarias'
      )
      const total = (countResult as any)[0].total
      console.log(`\n📈 Total de registros: ${total}`)

      if (total > 0) {
        // Mostrar primeiros 10 registros
        const [records] = await connection.query(
          'SELECT * FROM consignatarias LIMIT 10'
        )
        console.log('\n📄 Primeiros 10 registros:')
        console.log(JSON.stringify(records, null, 2))
      }
    } else {
      console.log('\n❌ Tabela "consignatarias" NÃO encontrada neste banco.')
    }

    // Verificar outras tabelas relacionadas
    console.log('\n\n🔍 Procurando outras tabelas relacionadas...')
    const relatedTables = ['empresas', 'empresa', 'convenios', 'convenio', 'socios', 'socio']
    
    for (const tableName of relatedTables) {
      const [exists] = await connection.query(
        `SHOW TABLES LIKE '${tableName}'`
      )
      if (Array.isArray(exists) && exists.length > 0) {
        const [count] = await connection.query(
          `SELECT COUNT(*) as total FROM ${tableName}`
        )
        const tableTotal = (count as any)[0].total
        console.log(`  ✅ ${tableName}: ${tableTotal} registros`)
      }
    }

  } catch (error: any) {
    console.error('❌ Erro ao conectar/consultar MySQL:', error.message)
    if (error.code === 'ECONNREFUSED') {
      console.error('   → Não foi possível conectar ao servidor MySQL')
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Acesso negado. Verifique usuário e senha')
    }
  } finally {
    if (connection) {
      await connection.end()
      console.log('\n🔌 Conexão encerrada.')
    }
  }
}

checkMySQLConsignatarias()

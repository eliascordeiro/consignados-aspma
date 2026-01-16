import mysql from 'mysql2/promise'

async function checkSociosTable() {
  let connection

  try {
    console.log('📡 Conectando ao MySQL remoto...\n')
    
    connection = await mysql.createConnection({
      host: '200.98.112.240',
      port: 3306,
      user: 'eliascordeiro',
      password: 'D24m0733@!',
      database: 'aspma'
    })

    console.log('✅ MySQL conectado!\n')

    // Verificar se a tabela existe
    console.log('🔍 Verificando tabela socios...\n')
    
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'socios'"
    )

    if (Array.isArray(tables) && tables.length === 0) {
      console.log('❌ Tabela "socios" não encontrada!')
      return
    }

    console.log('✅ Tabela "socios" encontrada!\n')

    // Verificar estrutura da tabela
    console.log('📋 Estrutura da tabela socios:\n')
    const [columns] = await connection.query('DESCRIBE socios')
    
    console.log('Colunas:')
    if (Array.isArray(columns)) {
      columns.forEach((col: any) => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`)
      })
    }

    // Contar registros
    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM socios')
    const total = Array.isArray(countResult) ? (countResult[0] as any).total : 0
    
    console.log(`\n📊 Total de registros: ${total}`)

    // Buscar alguns registros de exemplo
    if (total > 0) {
      console.log('\n📄 Primeiros 5 registros:\n')
      const [socios] = await connection.query('SELECT * FROM socios LIMIT 5')
      
      if (Array.isArray(socios)) {
        socios.forEach((socio: any, index: number) => {
          console.log(`${index + 1}. Sócio:`)
          Object.keys(socio).forEach(key => {
            console.log(`   ${key}: ${socio[key]}`)
          })
          console.log('')
        })
      }
    }

  } catch (error) {
    console.error('❌ Erro ao verificar tabela socios:', error)
  } finally {
    if (connection) {
      await connection.end()
      console.log('🔌 Conexão MySQL encerrada')
    }
  }
}

checkSociosTable()

import mysql from 'mysql2/promise'

async function main() {
  const mysqlConnection = await mysql.createConnection({
    host: '200.98.112.240',
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
    port: 3306
  })

  console.log('🔍 Verificando IDs de consignatarias e empresaId nos sócios...\n')

  // Verificar consignatarias
  const [consignatarias] = await mysqlConnection.query<any[]>(
    'SELECT id, nome FROM consignatarias ORDER BY id'
  )

  console.log('📋 Consignatarias no MySQL:')
  consignatarias.forEach((c) => {
    console.log(`   ID: ${c.id} - ${c.nome}`)
  })

  // Verificar estrutura da tabela socios
  const [columns] = await mysqlConnection.query<any[]>(
    'DESCRIBE socios'
  )

  console.log('\n📝 Colunas da tabela socios:')
  columns.forEach((col: any) => {
    console.log(`   ${col.Field} - ${col.Type} - ${col.Null} - ${col.Key}`)
  })

  // Verificar alguns exemplos de sócios
  const [exemplos] = await mysqlConnection.query<any[]>(
    'SELECT * FROM socios LIMIT 5'
  )

  console.log('\n📊 Exemplos de sócios:')
  exemplos.forEach((s) => {
    console.log(`   Sócio:`, s)
  })

  await mysqlConnection.end()
}

main()

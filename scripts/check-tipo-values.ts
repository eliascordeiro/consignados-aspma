import mysql from 'mysql2/promise'

async function main() {
  const mysqlConnection = await mysql.createConnection({
    host: '200.98.112.240',
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
    port: 3306
  })

  console.log('🔍 Verificando valores do campo tipo nos sócios...\n')

  // Verificar valores distintos de tipo
  const [tipos] = await mysqlConnection.query<any[]>(
    'SELECT DISTINCT tipo, COUNT(*) as total FROM socios GROUP BY tipo ORDER BY tipo'
  )

  console.log('📊 Valores de tipo encontrados:')
  tipos.forEach((t) => {
    console.log(`   Tipo: "${t.tipo}" (${typeof t.tipo}) - ${t.total} sócios`)
  })

  // Verificar alguns exemplos
  const [exemplos] = await mysqlConnection.query<any[]>(
    'SELECT id, nome, tipo FROM socios LIMIT 20'
  )

  console.log('\n📝 Exemplos de sócios:')
  exemplos.forEach((s) => {
    console.log(`   ID: ${s.id} - ${s.nome} - Tipo: "${s.tipo}" (${typeof s.tipo})`)
  })

  await mysqlConnection.end()
}

main()

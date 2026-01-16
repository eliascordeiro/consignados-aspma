import mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateConsignatarias() {
  let mysqlConnection

  try {
    console.log('🔄 Iniciando migração de consignatárias MySQL → PostgreSQL\n')

    // Conectar ao MySQL
    console.log('📡 Conectando ao MySQL...')
    mysqlConnection = await mysql.createConnection({
      host: '200.98.112.240',
      port: 3306,
      user: 'eliascordeiro',
      password: 'D24m0733@!',
      database: 'aspma',
      charset: 'utf8mb4'
    })
    console.log('✅ MySQL conectado!\n')

    // Buscar usuário ASPMA no PostgreSQL
    console.log('👤 Buscando usuário A.S.P.M.A no PostgreSQL...')
    const aspmaUser = await prisma.user.findUnique({
      where: { email: 'elias157508@gmail.com' }
    })

    if (!aspmaUser) {
      throw new Error('Usuário A.S.P.M.A não encontrado no PostgreSQL!')
    }
    console.log(`✅ Usuário encontrado: ${aspmaUser.name}\n`)

    // Buscar consignatarias do MySQL
    console.log('📥 Buscando consignatárias do MySQL...')
    const [consignatarias] = await mysqlConnection.query<any[]>(
      'SELECT * FROM consignatarias ORDER BY id'
    )
    console.log(`✅ ${consignatarias.length} consignatárias encontradas\n`)

    // Migrar cada consignatária
    let migrated = 0
    let skipped = 0

    for (const consig of consignatarias) {
      console.log(`\n📝 Processando: ${consig.nome}`)

      // Verificar se já existe no PostgreSQL (pelo nome exato)
      const exists = await prisma.empresa.findFirst({
        where: {
          userId: aspmaUser.id,
          nome: {
            contains: consig.nome.trim().substring(0, 20), // Buscar por parte do nome
            mode: 'insensitive'
          }
        }
      })

      if (exists) {
        console.log(`   ⏭️  Já existe (ID: ${exists.id})`)
        skipped++
        continue
      }

      // Criar no PostgreSQL
      const empresa = await prisma.empresa.create({
        data: {
          userId: aspmaUser.id,
          nome: consig.nome.trim(),
          cnpj: consig.cnpj?.trim() || null,
          email: consig.email?.trim() || null,
          telefone: consig.telefone?.trim() || null,
          tipo: 'PUBLICO', // Todas são órgãos públicos
          ativo: true
        }
      })

      console.log(`   ✅ Migrada com sucesso (ID: ${empresa.id})`)
      migrated++
    }

    // Resumo
    console.log('\n' + '═'.repeat(60))
    console.log('📊 RESUMO DA MIGRAÇÃO')
    console.log('═'.repeat(60))
    console.log(`Total processadas:    ${consignatarias.length}`)
    console.log(`Migradas com sucesso: ${migrated}`)
    console.log(`Já existiam:          ${skipped}`)
    console.log('═'.repeat(60))

    // Verificar total no PostgreSQL
    const totalPostgres = await prisma.empresa.count({
      where: { userId: aspmaUser.id }
    })
    console.log(`\n✅ Total de empresas no PostgreSQL: ${totalPostgres}`)

  } catch (error: any) {
    console.error('\n❌ Erro na migração:', error.message)
    throw error
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end()
      console.log('\n🔌 Conexão MySQL encerrada')
    }
    await prisma.$disconnect()
    console.log('🔌 Conexão PostgreSQL encerrada')
  }
}

migrateConsignatarias()
  .then(() => {
    console.log('\n✅ Migração concluída com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Falha na migração:', error)
    process.exit(1)
  })

import { PrismaClient } from '@prisma/client'
import mysql from 'mysql2/promise'

// Força o uso do banco Railway
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function replaceRailwayWithMySQL() {
  let mysqlConnection

  try {
    console.log('🔄 Atualizando banco RAILWAY com dados do MySQL\n')

    // Buscar usuário ASPMA no Railway
    console.log('👤 Buscando usuário A.S.P.M.A no Railway...')
    const aspmaUser = await prisma.user.findUnique({
      where: { email: 'elias157508@gmail.com' }
    })

    if (!aspmaUser) {
      throw new Error('Usuário A.S.P.M.A não encontrado no Railway!')
    }
    console.log(`✅ Usuário encontrado: ${aspmaUser.name}\n`)

    // Deletar todas as empresas fake do Railway
    console.log('🗑️  Deletando empresas do Railway...')
    const deleted = await prisma.empresa.deleteMany({
      where: { userId: aspmaUser.id }
    })
    console.log(`✅ ${deleted.count} empresas removidas do Railway\n`)

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

    // Buscar consignatarias do MySQL
    console.log('📥 Buscando consignatárias do MySQL...')
    const [consignatarias] = await mysqlConnection.query<any[]>(
      'SELECT * FROM consignatarias ORDER BY id'
    )
    console.log(`✅ ${consignatarias.length} consignatárias encontradas\n`)

    // Migrar cada consignatária para o Railway
    console.log('💾 Migrando consignatárias para Railway...\n')
    let migrated = 0

    for (const consig of consignatarias) {
      console.log(`📝 Migrando: ${consig.nome}`)

      const empresa = await prisma.empresa.create({
        data: {
          userId: aspmaUser.id,
          nome: consig.nome.trim(),
          cnpj: consig.cnpj?.trim() || null,
          email: consig.email?.trim() || null,
          telefone: consig.telefone?.trim() || null,
          tipo: 'PUBLICO',
          ativo: true
        }
      })

      console.log(`   ✅ ID: ${empresa.id} - ${empresa.nome}`)
      migrated++
    }

    // Resumo
    console.log('\n' + '═'.repeat(60))
    console.log('📊 RESUMO DA OPERAÇÃO NO RAILWAY')
    console.log('═'.repeat(60))
    console.log(`Empresas removidas:        ${deleted.count}`)
    console.log(`Consignatárias migradas:   ${migrated}`)
    console.log('═'.repeat(60))

    // Verificar total final no Railway
    const totalFinal = await prisma.empresa.count({
      where: { userId: aspmaUser.id }
    })
    console.log(`\n✅ Total final de empresas no Railway: ${totalFinal}`)

    // Listar empresas do Railway
    const empresas = await prisma.empresa.findMany({
      where: { userId: aspmaUser.id },
      orderBy: { nome: 'asc' }
    })
    
    console.log('\n📋 Empresas no Railway após migração:')
    empresas.forEach((emp, idx) => {
      console.log(`   ${idx + 1}. ${emp.nome}`)
      console.log(`      CNPJ: ${emp.cnpj || 'N/A'}`)
      console.log(`      Tipo: ${emp.tipo}`)
    })

  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
    throw error
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end()
      console.log('\n🔌 Conexão MySQL encerrada')
    }
    await prisma.$disconnect()
    console.log('🔌 Conexão Railway encerrada')
  }
}

replaceRailwayWithMySQL()
  .then(() => {
    console.log('\n✅ Railway atualizado com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Falha na atualização:', error)
    process.exit(1)
  })

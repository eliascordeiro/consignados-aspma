import mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function replaceWithMySQLData() {
  let mysqlConnection

  try {
    console.log('🔄 Substituindo dados fake por dados reais do MySQL\n')

    // Buscar usuário ASPMA
    console.log('👤 Buscando usuário A.S.P.M.A...')
    const aspmaUser = await prisma.user.findUnique({
      where: { email: 'elias157508@gmail.com' }
    })

    if (!aspmaUser) {
      throw new Error('Usuário A.S.P.M.A não encontrado!')
    }
    console.log(`✅ Usuário encontrado: ${aspmaUser.name}\n`)

    // Deletar todas as empresas fake
    console.log('🗑️  Deletando empresas fake do PostgreSQL...')
    const deleted = await prisma.empresa.deleteMany({
      where: { userId: aspmaUser.id }
    })
    console.log(`✅ ${deleted.count} empresas removidas\n`)

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

    // Migrar cada consignatária
    console.log('💾 Migrando consignatárias para PostgreSQL...\n')
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
          tipo: 'PUBLICO', // Consignatárias públicas
          ativo: true
        }
      })

      console.log(`   ✅ ID: ${empresa.id} - ${empresa.nome}`)
      migrated++
    }

    // Resumo
    console.log('\n' + '═'.repeat(60))
    console.log('📊 RESUMO DA OPERAÇÃO')
    console.log('═'.repeat(60))
    console.log(`Empresas removidas:   ${deleted.count}`)
    console.log(`Consignatárias importadas: ${migrated}`)
    console.log('═'.repeat(60))

    // Verificar total final
    const totalFinal = await prisma.empresa.count({
      where: { userId: aspmaUser.id }
    })
    console.log(`\n✅ Total final de empresas: ${totalFinal}`)

    // Listar empresas
    const empresas = await prisma.empresa.findMany({
      where: { userId: aspmaUser.id },
      orderBy: { nome: 'asc' }
    })
    
    console.log('\n📋 Empresas cadastradas:')
    empresas.forEach((emp, idx) => {
      console.log(`   ${idx + 1}. ${emp.nome}`)
      console.log(`      CNPJ: ${emp.cnpj || 'N/A'}`)
      console.log(`      Tipo: ${emp.tipo}`)
      console.log(`      Status: ${emp.ativo ? 'Ativo' : 'Inativo'}`)
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
    console.log('🔌 Conexão PostgreSQL encerrada')
  }
}

replaceWithMySQLData()
  .then(() => {
    console.log('\n✅ Operação concluída com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Falha na operação:', error)
    process.exit(1)
  })

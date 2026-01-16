import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanRailwayEmpresas() {
  try {
    console.log('🔄 Limpando empresas fake do Railway\n')

    // Buscar usuário ASPMA
    const aspmaUser = await prisma.user.findUnique({
      where: { email: 'elias157508@gmail.com' }
    })

    if (!aspmaUser) {
      console.log('❌ Usuário não encontrado!')
      return
    }

    console.log(`✅ Usuário: ${aspmaUser.name}\n`)

    // Listar empresas atuais
    const empresasAtuais = await prisma.empresa.findMany({
      where: { userId: aspmaUser.id }
    })

    console.log(`📊 Empresas atuais: ${empresasAtuais.length}`)
    empresasAtuais.forEach((emp, idx) => {
      console.log(`   ${idx + 1}. ${emp.nome} (ID: ${emp.id})`)
    })

    // Deletar TODAS as empresas
    console.log('\n🗑️  Deletando todas as empresas...')
    const deleted = await prisma.empresa.deleteMany({
      where: { userId: aspmaUser.id }
    })
    console.log(`✅ ${deleted.count} empresas removidas`)

    // Criar apenas as 2 consignatárias reais
    console.log('\n💾 Criando consignatárias reais...\n')

    const consig1 = await prisma.empresa.create({
      data: {
        userId: aspmaUser.id,
        nome: 'FUNDO DE PREVIDENCIA MUNICIPAL DE ARAUCARIA',
        tipo: 'PUBLICO',
        ativo: true
      }
    })
    console.log(`✅ ${consig1.nome}`)

    const consig2 = await prisma.empresa.create({
      data: {
        userId: aspmaUser.id,
        nome: 'PREFEITURA MUNICIPAL DE ARAUCARIA',
        tipo: 'PUBLICO',
        ativo: true
      }
    })
    console.log(`✅ ${consig2.nome}`)

    // Verificar total final
    const total = await prisma.empresa.count({
      where: { userId: aspmaUser.id }
    })
    
    console.log(`\n📊 Total final: ${total} empresas`)
    console.log('✅ Operação concluída!')

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanRailwayEmpresas()

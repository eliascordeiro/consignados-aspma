import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTestData() {
  console.log('🔍 Verificando dados de teste no banco...\n')

  try {
    // Verificar convênio
    const convenio = await prisma.convenio.findFirst({
      where: { usuario: 'teste' },
    })

    console.log('Convênio "teste":', convenio ? '✅ EXISTE' : '❌ NÃO EXISTE')
    if (convenio) {
      console.log('  - ID:', convenio.id)
      console.log('  - Razão Social:', convenio.razao_soc)
      console.log('  - Ativo:', convenio.ativo)
    }

    // Verificar sócios
    const socios = await prisma.socio.findMany({
      where: { matricula: { startsWith: '999' } },
    })

    console.log('\nSócios de teste:', socios.length > 0 ? `✅ ${socios.length} encontrados` : '❌ NÃO EXISTEM')
    socios.forEach(s => {
      console.log(`  - ${s.nome} (${s.matricula})`)
    })

    console.log('\n📊 Resumo:')
    console.log('  - Convênio:', convenio ? '✅' : '❌')
    console.log('  - Sócios:', socios.length > 0 ? '✅' : '❌')

    if (convenio && socios.length > 0) {
      console.log('\n🎉 Dados de teste EXISTEM no banco!')
      console.log('   Se o login não funciona, pode ser problema de comparação de senha.')
    } else {
      console.log('\n⚠️  Execute: npm run seed:railway')
    }

  } catch (error) {
    console.error('❌ Erro ao verificar:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTestData()

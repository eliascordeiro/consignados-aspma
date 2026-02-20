import { PrismaClient } from '@prisma/client'

// Este script pode ser executado com a DATABASE_URL do Railway
// railway run npm run seed:railway
// ou localmente com DATABASE_URL do Railway

const prisma = new PrismaClient()

async function seedRailway() {
  console.log('🚂 Criando dados de teste no Railway...')

  try {
    // 1. Criar convênio de teste
    const convenioExistente = await prisma.convenio.findFirst({
      where: { usuario: 'teste' },
    })

    if (!convenioExistente) {
      await prisma.convenio.create({
        data: {
          usuario: 'teste',
          senha: 'teste123',
          razao_soc: 'CONVÊNIO DE TESTE',
          fantasia: 'Teste',
          ativo: true,
          cnpj: '00.000.000/0000-00',
        },
      })
      console.log('✅ Convênio criado')
    } else {
      console.log('✅ Convênio já existe')
    }

    // 2. Criar empresa de teste
    let empresaTeste = await prisma.empresa.findFirst({
      where: { nome: 'EMPRESA TESTE SWAGGER' },
    })

    if (!empresaTeste) {
      empresaTeste = await prisma.empresa.create({
        data: {
          nome: 'EMPRESA TESTE SWAGGER',
          cnpj: '11.111.111/0001-11',
          ativo: true,
        },
      })
      console.log('✅ Empresa criada')
    } else {
      console.log('✅ Empresa já existe')
    }

    // 3. Criar sócios de teste
    const sociosTeste = [
      {
        nome: 'JOÃO DA SILVA TESTE',
        cpf: '111.111.111-11',
        matricula: '999001',
        tipo: '1',
        margemConsig: 500.00,
        limite: 1000.00,
      },
      {
        nome: 'MARIA SANTOS TESTE',
        cpf: '222.222.222-22',
        matricula: '999002',
        tipo: '3',
        margemConsig: 800.00,
        limite: 1500.00,
      },
      {
        nome: 'PEDRO OLIVEIRA TESTE',
        cpf: '333.333.333-33',
        matricula: '999003',
        tipo: '4',
        margemConsig: 1200.00,
        limite: 2000.00,
      },
    ]

    for (const socioData of sociosTeste) {
      const existente = await prisma.socio.findFirst({
        where: { cpf: socioData.cpf },
      })

      if (!existente) {
        await prisma.socio.create({
          data: {
            ...socioData,
            empresaId: empresaTeste.id,
            userId: null,
            ativo: true,
            bloqueio: 'N',
            celular: '(41) 99999-9999',
            telefone: '(41) 3333-3333',
          },
        })
        console.log(`✅ Sócio criado: ${socioData.nome}`)
      } else {
        console.log(`   Sócio já existe: ${socioData.nome}`)
      }
    }

    console.log('\n🎉 Dados criados com sucesso no Railway!')
    console.log('\n📝 Credenciais de teste:')
    console.log('   Usuário: teste')
    console.log('   Senha: teste123')
    console.log('   Matrículas: 999001, 999002, 999003')

  } catch (error) {
    console.error('❌ Erro:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedRailway()

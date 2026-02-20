import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestData() {
  console.log('🌱 Criando dados de teste para Swagger...')

  try {
    // Criar convênio de teste
    const convenioTeste = await prisma.convenio.findFirst({
      where: { usuario: 'teste' },
    })

    if (!convenioTeste) {
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
      console.log('✅ Convênio de teste criado')
      console.log('   Usuário: teste')
      console.log('   Senha: teste123')
    } else {
      console.log('✅ Convênio de teste já existe')
      console.log('   Usuário: teste')
      console.log('   Senha: teste123')
    }

    // Buscar ou criar empresa de teste
    let empresaTeste = await prisma.empresa.findFirst({
      where: { nome: 'EMPRESA TESTE SWAGGER' },
    })

    if (!empresaTeste) {
      empresaTeste = await prisma.empresa.create({
        data: {
          nome: 'EMPRESA TESTE SWAGGER',
          cnpj: '11.111.111/0001-11',
        },
      })
      console.log('✅ Empresa de teste criada')
    }

    // Criar sócios de teste (diferentes tipos)
    const sociosTeste = [
      {
        nome: 'JOÃO DA SILVA TESTE',
        cpf: '111.111.111-11',
        matricula: '999001',
        tipo: '1', // Tipo 1 - Consulta ZETRA
        margemConsig: 500.00,
        limite: 1000.00,
      },
      {
        nome: 'MARIA SANTOS TESTE',
        cpf: '222.222.222-22',
        matricula: '999002',
        tipo: '3', // Tipo 3 - Cálculo local
        margemConsig: 800.00,
        limite: 1500.00,
      },
      {
        nome: 'PEDRO OLIVEIRA TESTE',
        cpf: '333.333.333-33',
        matricula: '999003',
        tipo: '4', // Tipo 4 - Cálculo local
        margemConsig: 1200.00,
        limite: 2000.00,
      },
    ]

    for (const socioData of sociosTeste) {
      const socioExistente = await prisma.socio.findFirst({
        where: { cpf: socioData.cpf },
      })

      if (!socioExistente) {
        await prisma.socio.create({
          data: {
            ...socioData,
            empresaId: empresaTeste.id,
            userId: null, // Sem dono específico para testes
            ativo: true,
            bloqueio: 'N',
            celular: '(41) 99999-9999',
            telefone: '(41) 3333-3333',
          },
        })
        console.log(`✅ Sócio criado: ${socioData.nome} (Matrícula: ${socioData.matricula})`)
      } else {
        console.log(`   Sócio já existe: ${socioData.nome}`)
      }
    }

    console.log('\n🎉 Dados de teste criados com sucesso!')
    console.log('\n📝 Para testar no Swagger:')
    console.log('1. Acesse: /api-docs')
    console.log('2. Faça login com:')
    console.log('   - Usuário: teste')
    console.log('   - Senha: teste123')
    console.log('3. Use uma das matrículas: 999001, 999002, 999003')
    console.log('4. Ou CPFs: 111.111.111-11, 222.222.222-22, 333.333.333-33')

  } catch (error) {
    console.error('❌ Erro ao criar dados de teste:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createTestData()

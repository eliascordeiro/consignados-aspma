const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function seed() {
  console.log('🌱 Populando dados iniciais...\n')
  
  try {
    // Buscar o usuário admin
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    })
    
    if (!admin) {
      console.log('❌ Usuário admin não encontrado. Execute o seed de usuários primeiro.')
      return
    }
    
    console.log(`✅ Admin encontrado: ${admin.email}\n`)
    
    // Criar empresas base (Prefeitura e Fundo de Previdência)
    console.log('🏢 Criando empresas...\n')
    
    const prefeitura = await prisma.empresa.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        userId: admin.id,
        nome: 'Prefeitura Municipal de Araucária',
        cnpj: '76.105.501/0001-43',
        tipo: 'PUBLICO',
        ativo: true
      }
    })
    console.log(`   ✓ ${prefeitura.nome}`)
    
    const fundoPrevidencia = await prisma.empresa.upsert({
      where: { id: 3 },
      update: {},
      create: {
        id: 3,
        userId: admin.id,
        nome: 'Fundo Municipal de Previdência',
        cnpj: '12.345.678/0001-90',
        tipo: 'PUBLICO',
        ativo: true
      }
    })
    console.log(`   ✓ ${fundoPrevidencia.nome}`)
    
    // Criar alguns locais de exemplo
    console.log('\n🏪 Criando locais...\n')
    
    const bancoBrasil = await prisma.local.create({
      data: {
        userId: admin.id,
        nome: 'Banco do Brasil - Ag. Araucária',
        cnpj: '00.000.000/0001-91',
        tipo: 'BANCO',
        endereco: 'Av. Archelau de Almeida Torres, 500',
        cidade: 'Araucária',
        estado: 'PR',
        ativo: true
      }
    })
    console.log(`   ✓ ${bancoBrasil.nome}`)
    
    const caixa = await prisma.local.create({
      data: {
        userId: admin.id,
        nome: 'Caixa Econômica Federal',
        cnpj: '00.360.305/0001-04',
        tipo: 'BANCO',
        endereco: 'Rua Pedro Druszcz, 1234',
        cidade: 'Araucária',
        estado: 'PR',
        ativo: true
      }
    })
    console.log(`   ✓ ${caixa.nome}`)
    
    const comercio = await prisma.local.create({
      data: {
        userId: admin.id,
        nome: 'Magazine Luiza - Araucária',
        cnpj: '47.960.950/0001-21',
        tipo: 'COMERCIO',
        endereco: 'Rua Heitor Stockler de França, 789',
        cidade: 'Araucária',
        estado: 'PR',
        ativo: true
      }
    })
    console.log(`   ✓ ${comercio.nome}`)
    
    // Criar autorizações (Empresas autorizadas nos locais)
    console.log('\n🔐 Criando autorizações...\n')
    
    const auth1 = await prisma.autorizacao.create({
      data: {
        empresaId: prefeitura.id,
        localId: bancoBrasil.id,
        ativo: true
      }
    })
    console.log(`   ✓ Prefeitura → Banco do Brasil`)
    
    const auth2 = await prisma.autorizacao.create({
      data: {
        empresaId: prefeitura.id,
        localId: caixa.id,
        ativo: true
      }
    })
    console.log(`   ✓ Prefeitura → Caixa`)
    
    const auth3 = await prisma.autorizacao.create({
      data: {
        empresaId: fundoPrevidencia.id,
        localId: bancoBrasil.id,
        ativo: true
      }
    })
    console.log(`   ✓ Fundo de Previdência → Banco do Brasil`)
    
    const auth4 = await prisma.autorizacao.create({
      data: {
        empresaId: prefeitura.id,
        localId: comercio.id,
        ativo: true
      }
    })
    console.log(`   ✓ Prefeitura → Magazine Luiza`)
    
    console.log('\n✅ Seed concluído com sucesso!\n')
    
    // Resumo
    const totalEmpresas = await prisma.empresa.count()
    const totalLocais = await prisma.local.count()
    const totalAutorizacoes = await prisma.autorizacao.count()
    const totalSocios = await prisma.$queryRaw`SELECT COUNT(*) as count FROM socios`
    
    console.log('📊 Resumo:')
    console.log(`   Empresas: ${totalEmpresas}`)
    console.log(`   Locais: ${totalLocais}`)
    console.log(`   Autorizações: ${totalAutorizacoes}`)
    console.log(`   Sócios: ${totalSocios[0]?.count || 0}`)
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
    throw error
  }
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

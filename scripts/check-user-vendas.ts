import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function check() {
  console.log('🔍 Verificando usuário e vendas...\n')

  // Buscar usuário A.S.P.M.A
  const user = await prisma.users.findUnique({
    where: { email: 'elias157508@gmail.com' },
    select: { 
      id: true, 
      name: true, 
      email: true,
      createdById: true 
    }
  })

  if (!user) {
    console.log('❌ Usuário não encontrado!')
    return
  }

  console.log('👤 Usuário A.S.P.M.A:')
  console.log(`   ID: ${user.id}`)
  console.log(`   Nome: ${user.name}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   createdById: ${user.createdById || 'null'}\n`)

  // Contar sócios
  const sociosCount = await prisma.socio.count({
    where: { userId: user.id }
  })
  console.log(`📊 Sócios: ${sociosCount}`)

  // Contar vendas por userId
  const vendasCount = await prisma.venda.count({
    where: { userId: user.id }
  })
  console.log(`💰 Vendas (userId = ${user.id}): ${vendasCount}`)

  // Se createdById não é null, verificar vendas com esse ID também
  if (user.createdById) {
    const vendasCreatedBy = await prisma.venda.count({
      where: { userId: user.createdById }
    })
    console.log(`💰 Vendas (userId = ${user.createdById}): ${vendasCreatedBy}`)
  }

  // Buscar primeiras 5 vendas
  const vendas = await prisma.venda.findMany({
    where: { userId: user.id },
    take: 5,
    include: {
      socio: {
        select: { nome: true, matricula: true }
      },
      convenio: {
        select: { razao_soc: true }
      }
    },
    orderBy: { dataEmissao: 'desc' }
  })

  if (vendas.length > 0) {
    console.log('\n📋 Primeiras 5 vendas:')
    vendas.forEach((v, i) => {
      console.log(`   ${i+1}. Venda #${v.numeroVenda} - ${v.socio.nome} (${v.socio.matricula})`)
      console.log(`      Valor: R$ ${v.valorTotal} - ${v.quantidadeParcelas}x de R$ ${v.valorParcela}`)
    })
  } else {
    console.log('\n⚠️  Nenhuma venda encontrada!')
  }

  await prisma.$disconnect()
}

check()

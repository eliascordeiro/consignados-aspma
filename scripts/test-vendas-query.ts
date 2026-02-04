import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function test() {
  console.log('🧪 Testando query de vendas...\n')

  // Buscar usuário
  const user = await prisma.users.findUnique({
    where: { email: 'elias157508@gmail.com' }
  })

  if (!user) {
    console.log('❌ Usuário não encontrado!')
    return
  }

  console.log(`👤 Usuário: ${user.name}`)
  console.log(`   ID: ${user.id}`)
  console.log(`   createdById: ${user.createdById}\n`)

  // Simular a query da API com userId = session.user.id
  console.log('🔍 Testando query com session.user.id:')
  const targetUserId = user.id // Como está agora na API
  
  const whereClause = {
    userId: targetUserId,
    ativo: true
  }

  console.log('   whereClause:', JSON.stringify(whereClause, null, 2))

  const vendas = await prisma.venda.findMany({
    where: whereClause,
    take: 5,
    include: {
      socio: {
        select: {
          id: true,
          nome: true,
          matricula: true,
        },
      },
      convenio: {
        select: {
          id: true,
          razao_soc: true,
          fantasia: true,
        },
      },
      parcelas: {
        select: {
          id: true,
          numeroParcela: true,
          baixa: true,
        },
        orderBy: {
          numeroParcela: 'asc',
        },
      },
    },
    orderBy: [
      { dataEmissao: 'desc' },
      { numeroVenda: 'desc' },
    ],
  })

  console.log(`\n✅ Encontradas: ${vendas.length} vendas`)

  if (vendas.length > 0) {
    console.log('\n📋 Primeiras vendas:')
    vendas.forEach((v, i) => {
      console.log(`\n${i + 1}. Venda #${v.numeroVenda}`)
      console.log(`   Sócio: ${v.socio.nome} (${v.socio.matricula})`)
      console.log(`   Valor: R$ ${v.valorTotal}`)
      console.log(`   Parcelas: ${v.parcelas.length}`)
      console.log(`   Ativo: ${v.ativo}`)
      console.log(`   Cancelado: ${v.cancelado}`)
    })
  } else {
    console.log('\n⚠️  NENHUMA VENDA ENCONTRADA!')
    
    // Verificar se tem vendas sem filtro de ativo
    const todasVendas = await prisma.venda.count({
      where: { userId: targetUserId }
    })
    console.log(`\n   Total de vendas (sem filtro ativo): ${todasVendas}`)
    
    // Verificar distribuição por ativo
    const ativas = await prisma.venda.count({
      where: { userId: targetUserId, ativo: true }
    })
    const inativas = await prisma.venda.count({
      where: { userId: targetUserId, ativo: false }
    })
    console.log(`   Ativas: ${ativas}`)
    console.log(`   Inativas: ${inativas}`)
  }

  await prisma.$disconnect()
}

test()

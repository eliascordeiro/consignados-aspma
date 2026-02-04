import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO COMPLETO - VENDAS E PARCELAS\n')

  // 1. Buscar usuário A.S.P.M.A
  const aspma = await prisma.users.findUnique({
    where: { email: 'elias157508@gmail.com' }
  })

  if (!aspma) {
    console.log('❌ Usuário não encontrado!')
    return
  }

  console.log('👤 Usuário A.S.P.M.A:')
  console.log(`   ID: ${aspma.id}`)
  console.log(`   Nome: ${aspma.name}`)
  console.log(`   createdById: ${aspma.createdById || 'null'}\n`)

  // 2. Contar vendas por diferentes userIds
  console.log('💰 ANÁLISE DE VENDAS:')
  
  const vendasPorUserId = await prisma.venda.groupBy({
    by: ['userId'],
    _count: true,
    orderBy: { _count: { userId: 'desc' } },
    take: 5
  })

  console.log('   Vendas agrupadas por userId:')
  for (const grupo of vendasPorUserId) {
    const user = await prisma.users.findUnique({ where: { id: grupo.userId } })
    console.log(`   - ${grupo.userId}: ${grupo._count} vendas`)
    if (user) console.log(`     → ${user.name} (${user.email})`)
  }

  // 3. Contar vendas do usuário A.S.P.M.A
  const vendasAspma = await prisma.venda.count({
    where: { userId: aspma.id }
  })
  console.log(`\n   ✅ Vendas com userId = ${aspma.id}: ${vendasAspma}`)

  // 4. Se tem createdById, verificar vendas com esse ID
  if (aspma.createdById) {
    const vendasCreatedBy = await prisma.venda.count({
      where: { userId: aspma.createdById }
    })
    console.log(`   ⚠️  Vendas com userId = ${aspma.createdById}: ${vendasCreatedBy}`)
  }

  // 5. Buscar uma venda de exemplo
  const vendaExemplo = await prisma.venda.findFirst({
    where: { userId: aspma.id },
    include: {
      socio: true,
      convenio: true,
      parcelas: { take: 3 }
    }
  })

  if (vendaExemplo) {
    console.log('\n   📋 Exemplo de venda:')
    console.log(`      ID: ${vendaExemplo.id}`)
    console.log(`      Número: ${vendaExemplo.numeroVenda}`)
    console.log(`      userId: ${vendaExemplo.userId}`)
    console.log(`      Sócio: ${vendaExemplo.socio?.nome || 'N/A'}`)
    console.log(`      Valor: R$ ${vendaExemplo.valorTotal}`)
    console.log(`      Parcelas: ${vendaExemplo.parcelas.length}`)
  }

  // 6. Contar parcelas
  console.log('\n📋 ANÁLISE DE PARCELAS:')
  
  const totalParcelas = await prisma.parcela.count()
  console.log(`   Total de parcelas: ${totalParcelas}`)

  // Buscar parcela de exemplo
  const parcelaExemplo = await prisma.parcela.findFirst({
    include: {
      venda: {
        include: {
          socio: true
        }
      }
    }
  })

  if (parcelaExemplo) {
    console.log('\n   📋 Exemplo de parcela:')
    console.log(`      ID: ${parcelaExemplo.id}`)
    console.log(`      Número: ${parcelaExemplo.numeroParcela}`)
    console.log(`      Venda userId: ${parcelaExemplo.venda.userId}`)
    console.log(`      Sócio: ${parcelaExemplo.venda.socio?.nome || 'N/A'}`)
    console.log(`      Valor: R$ ${parcelaExemplo.valor}`)
  }

  // 7. Verificar sócios
  console.log('\n👥 ANÁLISE DE SÓCIOS:')
  
  const sociosAspma = await prisma.socio.count({
    where: { userId: aspma.id }
  })
  console.log(`   Sócios com userId = ${aspma.id}: ${sociosAspma}`)

  const socioExemplo = await prisma.socio.findFirst({
    where: { userId: aspma.id }
  })

  if (socioExemplo) {
    console.log('\n   👤 Exemplo de sócio:')
    console.log(`      Nome: ${socioExemplo.nome}`)
    console.log(`      Matrícula: ${socioExemplo.matricula}`)
    console.log(`      userId: ${socioExemplo.userId}`)
  } else {
    console.log('   ⚠️  Nenhum sócio encontrado!')
  }

  // 8. Resumo final
  console.log('\n' + '═'.repeat(60))
  console.log('📊 RESUMO:')
  console.log('═'.repeat(60))
  console.log(`ID PRINCIPAL (${aspma.id}):`)
  console.log(`   Sócios:   ${sociosAspma}`)
  console.log(`   Vendas:   ${vendasAspma}`)
  console.log(`   Parcelas: ${totalParcelas}`)
  
  if (aspma.createdById) {
    console.log(`\ncreatedById (${aspma.createdById}):`)
    const vendasCB = await prisma.venda.count({ where: { userId: aspma.createdById } })
    const sociosCB = await prisma.socio.count({ where: { userId: aspma.createdById } })
    console.log(`   Sócios:   ${sociosCB}`)
    console.log(`   Vendas:   ${vendasCB}`)
    
    if (vendasCB > 0 || sociosCB > 0) {
      console.log('\n⚠️  PROBLEMA: Dados estão no createdById, não no ID principal!')
    }
  }

  await prisma.$disconnect()
}

diagnose()

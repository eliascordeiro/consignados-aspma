import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function check() {
  const user = await prisma.users.findUnique({
    where: { email: 'elias157508@gmail.com' }
  })

  if (!user) {
    console.log('❌ Usuário não encontrado!')
    return
  }

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  📊 VERIFICAÇÃO COMPLETA DE DADOS                    ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log(`║  👤 Usuário: ${user.name?.substring(0, 30).padEnd(30)} ║`)
  console.log(`║  📧 Email: ${user.email.padEnd(32)} ║`)
  console.log(`║  🆔 ID: ${user.id.padEnd(35)} ║`)
  console.log(`║  🔗 createdById: ${(user.createdById || 'null').padEnd(26)} ║`)
  console.log('╠══════════════════════════════════════════════════════╣')

  // IDs para verificar
  const ids = [user.id]
  if (user.createdById) ids.push(user.createdById)

  console.log('║  🔍 Verificando dados em ambos os IDs:               ║')
  
  for (const id of ids) {
    const isMainId = id === user.id
    const label = isMainId ? '📍 ID PRINCIPAL' : '🔗 createdById'
    
    console.log(`╠══════════════════════════════════════════════════════╣`)
    console.log(`║  ${label.padEnd(50)} ║`)
    console.log(`║  (${id})          ║`)
    console.log('╠══════════════════════════════════════════════════════╣')

    const [socios, empresas, vendas, parcelas, convenios] = await Promise.all([
      prisma.socio.count({ where: { userId: id } }),
      prisma.empresa.count({ where: { userId: id } }),
      prisma.venda.count({ where: { userId: id } }),
      prisma.parcela.count({ 
        where: { 
          venda: { userId: id }
        }
      }),
      prisma.convenio.count({ where: { userId: id } })
    ])

    console.log(`║  👥 Sócios: ${String(socios).padStart(8).padEnd(37)} ║`)
    console.log(`║  🏢 Empresas: ${String(empresas).padStart(6).padEnd(35)} ║`)
    console.log(`║  💰 Vendas: ${String(vendas).padStart(8).padEnd(37)} ║`)
    console.log(`║  📋 Parcelas: ${String(parcelas).padStart(6).padEnd(35)} ║`)
    console.log(`║  🤝 Convênios: ${String(convenios).padStart(5).padEnd(34)} ║`)
  }

  console.log('╚══════════════════════════════════════════════════════╝')

  // Verificar sample de vendas e parcelas
  const vendaSample = await prisma.venda.findFirst({
    where: { userId: user.id },
    include: {
      socio: { select: { nome: true, matricula: true, userId: true } },
      _count: { select: { parcelas: true } }
    }
  })

  if (vendaSample) {
    console.log('\n📋 Exemplo de Venda:')
    console.log(`   Venda #${vendaSample.numeroVenda}`)
    console.log(`   Valor: R$ ${vendaSample.valorTotal}`)
    console.log(`   Sócio: ${vendaSample.socio.nome} (mat: ${vendaSample.socio.matricula})`)
    console.log(`   Sócio userId: ${vendaSample.socio.userId}`)
    console.log(`   Parcelas: ${vendaSample._count.parcelas}`)
  }

  await prisma.$disconnect()
}

check()

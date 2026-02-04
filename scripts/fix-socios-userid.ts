import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function fix() {
  console.log('🔧 Corrigindo userId dos sócios...\n')

  // Buscar usuário A.S.P.M.A
  const aspma = await prisma.users.findUnique({
    where: { email: 'elias157508@gmail.com' }
  })

  if (!aspma) {
    console.log('❌ Usuário não encontrado!')
    return
  }

  console.log(`👤 Usuário A.S.P.M.A: ${aspma.id}`)
  console.log(`   createdById: ${aspma.createdById}\n`)

  // Buscar sócios com userId = createdById
  const sociosErrados = await prisma.socio.findMany({
    where: { userId: aspma.createdById }
  })

  console.log(`📊 Sócios com userId errado: ${sociosErrados.length}`)

  // Buscar sócios com userId null
  const sociosNull = await prisma.socio.findMany({
    where: { userId: null }
  })

  console.log(`📊 Sócios com userId null: ${sociosNull.length}\n`)

  // Atualizar sócios do createdById para o ID principal
  if (sociosErrados.length > 0) {
    console.log(`🔄 Atualizando ${sociosErrados.length} sócios do createdById...`)
    const result = await prisma.socio.updateMany({
      where: { userId: aspma.createdById },
      data: { userId: aspma.id }
    })
    console.log(`✅ ${result.count} sócios atualizados!`)
  }

  // Atualizar sócios null para o ID principal
  if (sociosNull.length > 0) {
    console.log(`🔄 Atualizando ${sociosNull.length} sócios null...`)
    const result = await prisma.socio.updateMany({
      where: { userId: null },
      data: { userId: aspma.id }
    })
    console.log(`✅ ${result.count} sócios atualizados!`)
  }

  // Verificar resultado final
  const sociosCorretos = await prisma.socio.count({
    where: { userId: aspma.id }
  })

  console.log(`\n✅ Total de sócios com userId correto: ${sociosCorretos}`)

  await prisma.$disconnect()
}

fix()

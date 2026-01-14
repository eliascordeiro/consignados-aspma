const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function vincularASPMA() {
  console.log('🔗 Vinculando dados ao usuário A.S.P.M.A...\n')
  
  try {
    // Buscar ou criar usuário A.S.P.M.A
    let aspma = await prisma.user.findFirst({
      where: { 
        OR: [
          { name: { contains: 'A.S.P.M.A', mode: 'insensitive' } },
          { email: { contains: 'aspma', mode: 'insensitive' } }
        ]
      }
    })
    
    if (!aspma) {
      console.log('❌ Usuário A.S.P.M.A não encontrado.')
      console.log('\n📋 Usuários disponíveis:')
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true }
      })
      users.forEach(u => {
        console.log(`   - ${u.name} (${u.email}) [${u.role}]`)
      })
      return
    }
    
    console.log(`✅ Usuário encontrado: ${aspma.name} (${aspma.email})\n`)
    console.log(`   ID: ${aspma.id}`)
    console.log(`   Role: ${aspma.role}\n`)
    
    // Vincular todas as empresas ao A.S.P.M.A
    console.log('🏢 Vinculando empresas...')
    const empresasUpdate = await prisma.$executeRaw`
      UPDATE empresas 
      SET "userId" = ${aspma.id}
      WHERE "userId" IS NULL OR "userId" != ${aspma.id}
    `
    console.log(`   ✓ ${empresasUpdate} empresas vinculadas\n`)
    
    // Vincular todos os sócios ao A.S.P.M.A
    console.log('👥 Vinculando sócios...')
    const sociosUpdate = await prisma.$executeRaw`
      UPDATE socios 
      SET "userId" = ${aspma.id}
      WHERE "userId" IS NULL OR "userId" != ${aspma.id}
    `
    console.log(`   ✓ ${sociosUpdate} sócios vinculados\n`)
    
    // Vincular todos os convênios ao A.S.P.M.A
    console.log('🏪 Vinculando convênios...')
    const conveniosUpdate = await prisma.$executeRaw`
      UPDATE convenio 
      SET "userId" = ${aspma.id}
      WHERE "userId" IS NULL OR "userId" != ${aspma.id}
    `
    console.log(`   ✓ ${conveniosUpdate} convênios vinculados\n`)
    
    // Verificar resultado
    console.log('📊 Resumo dos dados vinculados ao A.S.P.M.A:\n')
    
    const empresasCount = await prisma.empresa.count({
      where: { userId: aspma.id }
    })
    console.log(`   Empresas: ${empresasCount}`)
    
    const sociosCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM socios WHERE "userId" = ${aspma.id}
    `
    console.log(`   Sócios: ${sociosCount[0].count}`)
    
    const conveniosCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM convenio WHERE "userId" = ${aspma.id}
    `
    console.log(`   Convênios: ${conveniosCount[0].count}`)
    
    console.log('\n✅ Vinculação concluída com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
    throw error
  }
}

vincularASPMA()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

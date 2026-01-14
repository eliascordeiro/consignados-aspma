const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Simula o portal do usuário A.S.P.M.A
 * Quando este usuário logar, ele verá todos os dados vinculados a ele
 */
async function portalASPMA(userId) {
  console.log('🌐 PORTAL A.S.P.M.A\n')
  console.log('=' .repeat(80) + '\n')
  
  try {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })
    
    if (!user) {
      console.log('❌ Usuário não encontrado')
      return
    }
    
    console.log(`👤 Usuário: ${user.name}`)
    console.log(`📧 Email: ${user.email}`)
    console.log(`🔑 Perfil: ${user.role}\n`)
    console.log('=' .repeat(80) + '\n')
    
    // 1. CONSIGNATÁRIAS
    const empresas = await prisma.empresa.findMany({
      where: { userId: userId },
      include: {
        socios: {
          where: { ativo: true },
          select: { id: true, nome: true, cpf: true }
        },
        autorizacoes: {
          where: { ativo: true },
          include: {
            convenio: {
              select: { id: true, nome: true }
            }
          }
        }
      }
    })
    
    console.log(`🏢 CONSIGNATÁRIAS (${empresas.length})\n`)
    empresas.forEach(emp => {
      console.log(`   📋 ${emp.nome}`)
      console.log(`      CNPJ: ${emp.cnpj || 'N/A'}`)
      console.log(`      Tipo: ${emp.tipo}`)
      console.log(`      Funcionários: ${emp.socios.length}`)
      console.log(`      Convênios autorizados: ${emp.autorizacoes.length}`)
      console.log('')
    })
    
    // 2. FUNCIONÁRIOS (SÓCIOS)
    const socios = await prisma.$queryRaw`
      SELECT s.*, e.nome as empresa_nome
      FROM socios s
      LEFT JOIN empresas e ON s."empresaId" = e.id
      WHERE s."userId" = ${userId}
      AND s.ativo = true
      ORDER BY e.nome, s.nome
      LIMIT 10
    `
    
    console.log(`\n👥 FUNCIONÁRIOS/SÓCIOS (Primeiros 10 de ${socios.length})\n`)
    socios.forEach(s => {
      console.log(`   • ${s.nome}`)
      console.log(`     CPF: ${s.cpf}`)
      console.log(`     Empresa: ${s.empresa_nome || 'N/A'}`)
      console.log(`     Matrícula: ${s.matricula || 'N/A'}`)
      console.log('')
    })
    
    // 3. CONVÊNIOS
    const convenios = await prisma.$queryRaw`
      SELECT * FROM convenio
      WHERE "userId" = ${userId}
      AND ativo = true
      ORDER BY nome
      LIMIT 10
    `
    
    console.log(`\n🏪 CONVÊNIOS/LOCAIS DE COMPRA (Primeiros 10 de ${convenios.length})\n`)
    convenios.forEach(c => {
      console.log(`   🏬 ${c.nome}`)
      if (c.tipo) console.log(`      Tipo: ${c.tipo}`)
      if (c.cidade) console.log(`      Cidade: ${c.cidade}`)
      if (c.cnpj) console.log(`      CNPJ: ${c.cnpj}`)
      console.log('')
    })
    
    // ESTATÍSTICAS
    console.log('\n📊 ESTATÍSTICAS GERAIS\n')
    
    const totalEmpresas = await prisma.empresa.count({ where: { userId } })
    const totalSocios = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM socios WHERE "userId" = ${userId}
    `
    const totalConvenios = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM convenio WHERE "userId" = ${userId}
    `
    const totalAutorizacoes = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM autorizacoes a
      INNER JOIN empresas e ON a."empresaId" = e.id
      WHERE e."userId" = ${userId}
      AND a.ativo = true
    `
    
    console.log(`   📌 Consignatárias: ${totalEmpresas}`)
    console.log(`   📌 Funcionários: ${totalSocios[0].count}`)
    console.log(`   📌 Convênios: ${totalConvenios[0].count}`)
    console.log(`   📌 Autorizações ativas: ${totalAutorizacoes[0].count}`)
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
    throw error
  }
}

// Executar para o usuário A.S.P.M.A
async function main() {
  // Buscar A.S.P.M.A
  const aspma = await prisma.user.findFirst({
    where: { 
      OR: [
        { name: { contains: 'A.S.P.M.A', mode: 'insensitive' } },
        { email: { contains: 'aspma', mode: 'insensitive' } }
      ]
    }
  })
  
  if (aspma) {
    await portalASPMA(aspma.id)
  } else {
    console.log('❌ Usuário A.S.P.M.A não encontrado')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

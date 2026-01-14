const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function consultarEstrutura() {
  console.log('📊 Estrutura Completa do Sistema\n')
  console.log('=' .repeat(80) + '\n')
  
  try {
    // Empresas
    const empresasQuery = await prisma.$queryRaw`
      SELECT id, nome, cnpj, tipo, ativo 
      FROM empresas 
      ORDER BY id
    `
    
    console.log('🏢 EMPRESAS (Consignatárias):\n')
    empresasQuery.forEach(emp => {
      console.log(`   ${emp.id}. ${emp.nome}`)
      console.log(`      CNPJ: ${emp.cnpj || 'N/A'}`)
      console.log(`      Tipo: ${emp.tipo}`)
      console.log(`      Status: ${emp.ativo ? 'Ativa' : 'Inativa'}\n`)
    })
    
    // Convênios
    const convenios = await prisma.$queryRaw`
      SELECT * FROM convenio 
      ORDER BY nome 
      LIMIT 10
    `
    
    console.log('\n🏪 CONVÊNIOS (Comércios/Bancos):\n')
    convenios.forEach((conv, i) => {
      console.log(`   ${i + 1}. ${conv.nome || 'Sem nome'}`)
      if (conv.cnpj) console.log(`      CNPJ: ${conv.cnpj}`)
      if (conv.tipo) console.log(`      Tipo: ${conv.tipo}`)
      if (conv.cidade) console.log(`      Cidade: ${conv.cidade}`)
      console.log('')
    })
    
    // Sócios
    const totalSocios = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM socios
    `
    
    const sociosPorEmpresa = await prisma.$queryRaw`
      SELECT empresaId, COUNT(*) as total 
      FROM socios 
      GROUP BY empresaId 
      ORDER BY empresaId
    `
    
    console.log('\n👥 SÓCIOS (Funcionários):\n')
    console.log(`   Total: ${totalSocios[0].total} sócios\n`)
    console.log('   Por empresa:')
    sociosPorEmpresa.forEach(s => {
      const empresa = empresasQuery.find(e => e.id === s.empresaid)
      console.log(`      Empresa ${s.empresaid} (${empresa?.nome || 'N/A'}): ${s.total} sócios`)
    })
    
    // Autorizações
    const autorizacoes = await prisma.$queryRaw`
      SELECT a.*, e.nome as empresa_nome, c.nome as convenio_nome
      FROM autorizacoes a
      LEFT JOIN empresas e ON a."empresaId" = e.id
      LEFT JOIN convenio c ON a."convenioId" = c.id
      WHERE a.ativo = true
      ORDER BY a."empresaId", a."convenioId"
    `
    
    console.log('\n\n🔐 AUTORIZAÇÕES (Empresa ↔ Convênio):\n')
    if (autorizacoes.length > 0) {
      autorizacoes.forEach(auth => {
        console.log(`   ✓ ${auth.empresa_nome} → ${auth.convenio_nome}`)
      })
    } else {
      console.log('   Nenhuma autorização cadastrada ainda.')
    }
    
    // Resumo
    const totalConvenios = await prisma.$queryRaw`SELECT COUNT(*) as total FROM convenio`
    const totalEmpresas = empresasQuery.length
    const totalAuth = autorizacoes.length
    
    console.log('\n\n📈 RESUMO GERAL:\n')
    console.log(`   Empresas: ${totalEmpresas}`)
    console.log(`   Convênios: ${totalConvenios[0].total}`)
    console.log(`   Sócios: ${totalSocios[0].total}`)
    console.log(`   Autorizações: ${totalAuth}`)
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
    throw error
  }
}

consultarEstrutura()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

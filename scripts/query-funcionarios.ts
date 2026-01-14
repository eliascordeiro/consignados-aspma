import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Consultando funcionários...\n')
  
  // Consulta todos os funcionários
  const funcionarios = await prisma.funcionario.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Total encontrado: ${funcionarios.length} funcionários\n`)
  
  funcionarios.forEach((f, index) => {
    console.log(`\n${index + 1}. ${f.nome}`)
    console.log(`   CPF: ${f.cpf}`)
    console.log(`   Tipo: ${f.tipo}`)
    console.log(`   Órgão: ${f.orgao}`)
    console.log(`   Matrícula: ${f.matricula || 'N/A'}`)
    console.log(`   Setor: ${f.setor || 'N/A'}`)
    console.log(`   Ativo: ${f.ativo ? 'Sim' : 'Não'}`)
  })
  
  // Agrupa por tipo
  console.log('\n\n📊 Agrupamento por Tipo:\n')
  const porTipo = await prisma.funcionario.groupBy({
    by: ['tipo'],
    _count: true
  })
  
  porTipo.forEach(grupo => {
    console.log(`   ${grupo.tipo}: ${grupo._count} funcionários`)
  })
  
  // Agrupa por órgão
  console.log('\n\n🏢 Agrupamento por Órgão:\n')
  const porOrgao = await prisma.funcionario.groupBy({
    by: ['orgao'],
    _count: true,
    orderBy: {
      _count: {
        orgao: 'desc'
      }
    }
  })
  
  porOrgao.forEach(grupo => {
    console.log(`   ${grupo.orgao}: ${grupo._count} funcionários`)
  })
}

main()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

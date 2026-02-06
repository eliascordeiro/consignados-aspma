import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkEmpresas() {
  try {
    console.log('🔍 Verificando tabela empresas...\n')
    
    const count = await prisma.empresa.count()
    console.log(`Total de empresas: ${count}`)
    
    if (count > 0) {
      const empresas = await prisma.empresa.findMany({
        take: 10,
        orderBy: { id: 'asc' }
      })
      
      console.log('\n📋 Primeiras empresas:')
      empresas.forEach(emp => {
        console.log(`  ID: ${emp.id} - Nome: ${emp.nome} - CNPJ: ${emp.cnpj || 'N/A'} - Tipo: ${emp.tipo} - Ativo: ${emp.ativo}`)
      })
    } else {
      console.log('\n⚠️  Tabela empresas está vazia!')
      console.log('\nDeseja popular com dados básicos? Execute: npx tsx app/scripts/seed-empresas.ts')
    }
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkEmpresas()

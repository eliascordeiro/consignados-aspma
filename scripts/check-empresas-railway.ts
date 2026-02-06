import { PrismaClient } from '@prisma/client'

// Conectar direto no Railway
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function checkEmpresasRailway() {
  try {
    console.log('🚂 Conectando no Railway...\n')
    
    await prisma.$connect()
    console.log('✅ Conectado!\n')
    
    const empresas = await prisma.empresa.findMany({
      orderBy: { id: 'asc' }
    })
    
    console.log(`📋 Total de empresas no Railway: ${empresas.length}\n`)
    
    if (empresas.length > 0) {
      empresas.forEach(emp => {
        console.log(`ID: ${emp.id}`)
        console.log(`Nome: ${emp.nome}`)
        console.log(`CNPJ: ${emp.cnpj || 'N/A'}`)
        console.log(`Tipo: ${emp.tipo}`)
        console.log(`UserID: ${emp.userId || 'NULL'}`)
        console.log(`Ativo: ${emp.ativo}`)
        console.log(`---`)
      })
    } else {
      console.log('⚠️  Nenhuma empresa encontrada no Railway')
    }
    
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkEmpresasRailway()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function createNenhumaEmpresa() {
  try {
    console.log('🔄 Criando empresa "NENHUMA" para consignataria = 0...\n')

    const aspmaUser = await prisma.user.findUnique({
      where: { email: 'elias157508@gmail.com' }
    })

    if (!aspmaUser) {
      throw new Error('Usuário A.S.P.M.A não encontrado!')
    }

    // Verificar se já existe
    const existing = await prisma.empresa.findFirst({
      where: {
        userId: aspmaUser.id,
        nome: 'NENHUMA'
      }
    })

    if (existing) {
      console.log(`✅ Empresa "NENHUMA" já existe com ID: ${existing.id}`)
      return existing.id
    }

    // Criar empresa NENHUMA
    const nenhuma = await prisma.empresa.create({
      data: {
        userId: aspmaUser.id,
        nome: 'NENHUMA',
        tipo: 'PUBLICO',
        ativo: true
      }
    })

    console.log(`✅ Empresa "NENHUMA" criada com ID: ${nenhuma.id}`)
    
    // Listar todas as empresas
    console.log('\n📋 Empresas cadastradas:\n')
    const empresas = await prisma.empresa.findMany({
      where: { userId: aspmaUser.id },
      orderBy: { id: 'asc' }
    })

    empresas.forEach(emp => {
      console.log(`   ID ${emp.id}: ${emp.nome}`)
    })

    return nenhuma.id

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createNenhumaEmpresa()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllEmpresas() {
  try {
    console.log('🔍 Verificando TODAS as empresas no Railway...\n')
    
    // Buscar TODAS as empresas, de todos os usuários
    const todasEmpresas = await prisma.empresa.findMany({
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: { id: 'asc' }
    })

    console.log(`📊 Total de empresas no banco: ${todasEmpresas.length}\n`)

    if (todasEmpresas.length > 0) {
      console.log('📋 TODAS as empresas cadastradas:\n')
      console.log('='.repeat(80))
      todasEmpresas.forEach((emp, idx) => {
        console.log(`${idx + 1}. [ID: ${emp.id}] ${emp.nome}`)
        console.log(`   CNPJ: ${emp.cnpj || 'N/A'}`)
        console.log(`   Tipo: ${emp.tipo}`)
        console.log(`   Usuário: ${emp.user?.name || 'N/A'} (${emp.user?.email || 'N/A'})`)
        console.log(`   User ID: ${emp.userId}`)
        console.log(`   Ativo: ${emp.ativo ? 'Sim' : 'Não'}`)
        console.log('-'.repeat(80))
      })
    }

    // Contar por usuário
    const porUsuario = await prisma.empresa.groupBy({
      by: ['userId'],
      _count: true
    })

    console.log('\n📊 Empresas por usuário:')
    for (const grupo of porUsuario) {
      const user = await prisma.user.findUnique({
        where: { id: grupo.userId }
      })
      console.log(`   • ${user?.name || 'N/A'} (${user?.email || 'N/A'}): ${grupo._count} empresas`)
    }

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAllEmpresas()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function verifySociosRailway() {
  try {
    console.log('🔍 Verificando sócios no Railway PostgreSQL...\n')

    const aspmaUser = await prisma.user.findUnique({
      where: { email: 'elias157508@gmail.com' }
    })

    if (!aspmaUser) {
      console.log('❌ Usuário A.S.P.M.A não encontrado!')
      return
    }

    // Total geral
    const totalSocios = await prisma.socio.count({
      where: { userId: aspmaUser.id }
    })

    // Por empresa
    const porEmpresa = await prisma.socio.groupBy({
      by: ['empresaId'],
      where: { userId: aspmaUser.id },
      _count: true
    })

    // Ativos vs Inativos
    const ativos = await prisma.socio.count({
      where: {
        userId: aspmaUser.id,
        ativo: true
      }
    })

    const inativos = await prisma.socio.count({
      where: {
        userId: aspmaUser.id,
        ativo: false
      }
    })

    // Empresas
    const empresas = await prisma.empresa.findMany({
      where: { userId: aspmaUser.id },
      include: {
        _count: {
          select: { socios: true }
        }
      }
    })

    console.log('═══════════════════════════════════════════════════════════')
    console.log('📊 ESTATÍSTICAS DOS SÓCIOS NO RAILWAY')
    console.log('═══════════════════════════════════════════════════════════\n')
    
    console.log(`👤 Usuário: ${aspmaUser.name}`)
    console.log(`📧 Email: ${aspmaUser.email}`)
    console.log(`🆔 ID: ${aspmaUser.id}\n`)

    console.log(`📋 Total de sócios: ${totalSocios}`)
    console.log(`✅ Ativos: ${ativos}`)
    console.log(`❌ Inativos: ${inativos}\n`)

    console.log('🏢 Sócios por Empresa:\n')
    empresas.forEach(empresa => {
      console.log(`   ${empresa.nome}`)
      console.log(`   ID: ${empresa.id}`)
      console.log(`   Sócios: ${empresa._count.socios}`)
      console.log('')
    })

    // Exemplos de sócios migrados
    console.log('📋 Exemplos de sócios (primeiros 10):\n')
    const exemplos = await prisma.socio.findMany({
      where: { userId: aspmaUser.id },
      take: 10,
      include: { empresa: true },
      orderBy: { matricula: 'asc' }
    })

    exemplos.forEach((socio, idx) => {
      console.log(`${idx + 1}. ${socio.nome}`)
      console.log(`   CPF: ${socio.cpf || 'N/A'}`)
      console.log(`   Matrícula: ${socio.matricula || 'N/A'}`)
      console.log(`   Função: ${socio.funcao || 'N/A'}`)
      console.log(`   Empresa: ${socio.empresa.nome}`)
      console.log(`   Status: ${socio.ativo ? 'Ativo' : 'Inativo'}`)
      console.log('')
    })

    console.log('═══════════════════════════════════════════════════════════')

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifySociosRailway()

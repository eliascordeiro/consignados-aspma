import { PrismaClient } from '@prisma/client'

// Conectar direto no Railway
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function seedEmpresasRailway() {
  try {
    console.log('🚂 Conectando no Railway...\n')
    
    // Testar conexão
    await prisma.$connect()
    console.log('✅ Conectado no Railway!\n')
    
    // Verificar se já existem empresas
    const count = await prisma.empresa.count()
    console.log(`📊 Empresas existentes no Railway: ${count}\n`)
    
    const empresas = [
      {
        nome: 'PREFEITURA MUNICIPAL DE ARAUCÁRIA',
        cnpj: '76.105.643/0001-86',
        tipo: 'PUBLICO' as const,
        telefone: '(41) 3614-1900',
        email: 'prefeitura@araucaria.pr.gov.br',
        rua: 'Rua Pedro Druszcz',
        numero: '1011',
        bairro: 'Centro',
        cidade: 'Araucária',
        uf: 'PR',
        cep: '83701-020',
        ativo: true,
      },
      {
        nome: 'FUNDO DE PREVIDÊNCIA MUNICIPAL DE ARAUCÁRIA',
        cnpj: '04.310.381/0001-67',
        tipo: 'PUBLICO' as const,
        telefone: '(41) 3614-7800',
        email: 'fundoprevidencia@araucaria.pr.gov.br',
        rua: 'Rua Pedro Druszcz',
        numero: '1011',
        bairro: 'Centro',
        cidade: 'Araucária',
        uf: 'PR',
        cep: '83701-020',
        ativo: true,
      },
      {
        nome: 'NENHUMA',
        tipo: 'PUBLICO' as const,
        ativo: true,
      },
    ]
    
    let criadas = 0
    let jaExistentes = 0
    
    for (const empresaData of empresas) {
      // Verificar se já existe pelo nome
      const existe = await prisma.empresa.findFirst({
        where: { nome: empresaData.nome }
      })
      
      if (existe) {
        console.log(`⏭️  "${empresaData.nome}" já existe (ID: ${existe.id})`)
        jaExistentes++
        continue
      }
      
      const empresa = await prisma.empresa.create({
        data: empresaData
      })
      
      console.log(`✅ Criada: "${empresa.nome}" (ID: ${empresa.id})`)
      criadas++
    }
    
    console.log(`\n📈 Resumo:`)
    console.log(`   ✅ Criadas: ${criadas}`)
    console.log(`   ⏭️  Já existentes: ${jaExistentes}`)
    
    // Mostrar todas as empresas do Railway
    const todasEmpresas = await prisma.empresa.findMany({
      orderBy: { id: 'asc' }
    })
    
    console.log(`\n📋 Total de empresas no Railway: ${todasEmpresas.length}`)
    if (todasEmpresas.length > 0) {
      todasEmpresas.forEach(emp => {
        console.log(`  [${emp.id}] ${emp.nome} - ${emp.cnpj || 'Sem CNPJ'} - ${emp.ativo ? 'Ativo' : 'Inativo'}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Erro ao popular empresas no Railway:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedEmpresasRailway()

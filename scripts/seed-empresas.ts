import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedEmpresas() {
  try {
    console.log('🌱 Populando tabela empresas...\n')
    
    // Verificar se já existem empresas
    const count = await prisma.empresa.count()
    if (count > 0) {
      console.log(`⚠️  Já existem ${count} empresas cadastradas.`)
      const confirmar = process.argv.includes('--force')
      if (!confirmar) {
        console.log('Use --force para adicionar mesmo assim.')
        return
      }
    }
    
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
    
    for (const empresaData of empresas) {
      // Verificar se já existe pelo nome
      const existe = await prisma.empresa.findFirst({
        where: { nome: empresaData.nome }
      })
      
      if (existe) {
        console.log(`⏭️  "${empresaData.nome}" já existe (ID: ${existe.id})`)
        continue
      }
      
      const empresa = await prisma.empresa.create({
        data: empresaData
      })
      
      console.log(`✅ Criada: "${empresa.nome}" (ID: ${empresa.id})`)
      criadas++
    }
    
    console.log(`\n🎉 Processo concluído! ${criadas} empresas criadas.`)
    
    // Mostrar todas as empresas
    const todasEmpresas = await prisma.empresa.findMany({
      orderBy: { id: 'asc' }
    })
    
    console.log(`\n📋 Total de empresas no banco: ${todasEmpresas.length}`)
    todasEmpresas.forEach(emp => {
      console.log(`  [${emp.id}] ${emp.nome} - ${emp.cnpj || 'Sem CNPJ'} - ${emp.ativo ? 'Ativo' : 'Inativo'}`)
    })
    
  } catch (error) {
    console.error('❌ Erro ao popular empresas:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedEmpresas()

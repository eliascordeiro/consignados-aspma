import { prisma } from '../src/lib/prisma'

async function main() {
  // Buscar o usuário A.S.P.M.A
  const aspma = await prisma.user.findUnique({
    where: { email: 'elias157508@gmail.com' }
  })

  if (!aspma) {
    console.error('❌ Usuário A.S.P.M.A não encontrado!')
    return
  }

  console.log(`✅ Usuário encontrado: ${aspma.name} (${aspma.email})`)

  // Dados fake de consignatárias
  const consignatarias = [
    {
      nome: 'Prefeitura Municipal de Araucária',
      cnpj: '76.105.501/0001-31',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3614-1600',
      email: 'rh@araucaria.pr.gov.br',
      contato: 'Maria Silva',
      cep: '83701-020',
      rua: 'Rua Pedro Druszcz',
      numero: '1701',
      bairro: 'Centro',
      cidade: 'Araucária',
      uf: 'PR'
    },
    {
      nome: 'Fundo de Previdência Municipal',
      cnpj: '12.345.678/0001-90',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3614-2200',
      email: 'atendimento@fundoprev.araucaria.pr.gov.br',
      contato: 'João Santos',
      cep: '83702-100',
      rua: 'Avenida das Araucárias',
      numero: '500',
      bairro: 'Fazendinha',
      cidade: 'Araucária',
      uf: 'PR'
    },
    {
      nome: 'Câmara Municipal de Araucária',
      cnpj: '98.765.432/0001-10',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3614-3000',
      email: 'camara@araucaria.pr.leg.br',
      contato: 'Ana Paula Costa',
      cep: '83701-015',
      rua: 'Rua Heitor Stockler de França',
      numero: '1500',
      bairro: 'Centro',
      cidade: 'Araucária',
      uf: 'PR'
    },
    {
      nome: 'SANEPAR - Araucária',
      cnpj: '76.484.013/0025-45',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3614-5500',
      email: 'rh.araucaria@sanepar.com.br',
      contato: 'Carlos Eduardo Lima',
      cep: '83703-300',
      rua: 'Rua João Batista',
      numero: '2000',
      bairro: 'Campina da Barra',
      cidade: 'Araucária',
      uf: 'PR'
    },
    {
      nome: 'COPEL - Cia Paranaense de Energia',
      cnpj: '76.483.817/0001-20',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3331-4444',
      email: 'recursoshumanos@copel.com',
      contato: 'Roberto Martins',
      cep: '80420-050',
      rua: 'Rua Coronel Dulcídio',
      numero: '800',
      bairro: 'Água Verde',
      cidade: 'Curitiba',
      uf: 'PR'
    },
    {
      nome: 'Secretaria de Saúde Municipal',
      cnpj: '15.987.654/0001-88',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3614-7700',
      email: 'saude@araucaria.pr.gov.br',
      contato: 'Dra. Fernanda Oliveira',
      cep: '83702-560',
      rua: 'Rua das Framboesas',
      numero: '150',
      bairro: 'Capela Velha',
      cidade: 'Araucária',
      uf: 'PR'
    },
    {
      nome: 'Secretaria de Educação',
      cnpj: '25.874.963/0001-47',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3614-8800',
      email: 'educacao@araucaria.pr.gov.br',
      contato: 'Prof. Ricardo Almeida',
      cep: '83701-290',
      rua: 'Rua Luiz Pasteur',
      numero: '300',
      bairro: 'Centro',
      cidade: 'Araucária',
      uf: 'PR'
    },
    {
      nome: 'Hospital Municipal de Araucária',
      cnpj: '36.258.147/0001-25',
      tipo: 'PUBLICO' as const,
      telefone: '(41) 3614-9900',
      email: 'hospital@araucaria.pr.gov.br',
      contato: 'Dr. Paulo Henrique',
      cep: '83703-470',
      rua: 'Rua Heitor de Alencar Furtado',
      numero: '1000',
      bairro: 'Costeira',
      cidade: 'Araucária',
      uf: 'PR'
    }
  ]

  console.log('\n🔄 Criando consignatárias...\n')

  for (const data of consignatarias) {
    const exists = await prisma.empresa.findUnique({
      where: { cnpj: data.cnpj }
    })

    if (exists) {
      console.log(`⏭️  ${data.nome} - já existe`)
      continue
    }

    const empresa = await prisma.empresa.create({
      data: {
        ...data,
        userId: aspma.id
      }
    })

    console.log(`✅ ${empresa.nome} - criada (ID: ${empresa.id})`)
  }

  console.log('\n✨ Processo concluído!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

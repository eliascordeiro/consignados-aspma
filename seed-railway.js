const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function main() {
  console.log('🌱 Iniciando seed no Railway...')

  // Criar usuário A.S.P.M.A
  const hashedPassword = await bcrypt.hash('aspma2024', 10)
  
  const aspma = await prisma.user.upsert({
    where: { email: 'elias157508@gmail.com' },
    update: {},
    create: {
      id: 'cmkeaodeq00007zofci9t08yw',
      email: 'elias157508@gmail.com',
      name: 'A.S.P.M.A',
      password: hashedPassword,
      role: 'MANAGER',
      cpf: '00000000000',
      active: true
    }
  })

  console.log('✅ Usuário A.S.P.M.A criado:', aspma.email)

  // Criar as 8 empresas
  const empresas = [
    { id: 1, nome: 'CAIXA ECONOMICA FEDERAL', cnpj: '00360305000104', tipo: 'PUBLICO' },
    { id: 2, nome: 'ITAU UNIBANCO S/A', cnpj: '60701190000104', tipo: 'PRIVADO' },
    { id: 3, nome: 'BANCO DO BRASIL S/A', cnpj: '00000000000191', tipo: 'PUBLICO' },
    { id: 4, nome: 'BANCO BRADESCO S/A', cnpj: '60746948000112', tipo: 'PRIVADO' },
    { id: 5, nome: 'BANCO SANTANDER BRASIL S/A', cnpj: '90400888000142', tipo: 'PRIVADO' },
    { id: 6, nome: 'BANRISUL', cnpj: '92702067000196', tipo: 'PUBLICO' },
    { id: 7, nome: 'BANCO SAFRA S/A', cnpj: '58160789000128', tipo: 'PRIVADO' },
    { id: 8, nome: 'BANCO PAN S/A', cnpj: '59285411000113', tipo: 'PRIVADO' }
  ]

  for (const emp of empresas) {
    await prisma.empresa.upsert({
      where: { id: emp.id },
      update: {},
      create: {
        id: emp.id,
        nome: emp.nome,
        cnpj: emp.cnpj,
        tipo: emp.tipo,
        userId: aspma.id,
        ativo: true
      }
    })
    console.log(`✅ Empresa criada: ${emp.nome}`)
  }

  console.log('🎉 Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

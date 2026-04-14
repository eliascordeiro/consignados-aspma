import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' } }
})

async function main() {
  // Buscar o usuário elias
  const elias = await (prisma as any).users.findFirst({
    where: { email: { contains: 'elias157508', mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      createdById: true,
      managerPrincipalId: true,
    }
  })

  if (!elias) {
    console.log('❌ Usuário elias157508 não encontrado no banco')
    return
  }

  console.log('\n📌 USUÁRIO ENCONTRADO:')
  console.log(`  Email: ${elias.email}`)
  console.log(`  Nome: ${elias.name}`)
  console.log(`  Role: ${elias.role}`)
  console.log(`  createdById: ${elias.createdById ?? 'null'}`)
  console.log(`  managerPrincipalId: ${elias.managerPrincipalId ?? 'null'}`)
  console.log(`  Criado em: ${elias.createdAt}`)

  if (elias.createdById) {
    const criador = await (prisma as any).users.findUnique({
      where: { id: elias.createdById },
      select: {
        id: true, email: true, name: true, role: true,
        managerPrincipalId: true,
      }
    })
    console.log('\n👤 CRIADO POR:')
    console.log(`  Email: ${criador?.email}`)
    console.log(`  Nome: ${criador?.name}`)
    console.log(`  Role: ${criador?.role}`)
    console.log(`  managerPrincipalId: ${criador?.managerPrincipalId ?? 'null'}`)

    if (criador?.managerPrincipalId) {
      const principal = await (prisma as any).users.findUnique({
        where: { id: criador.managerPrincipalId },
        select: { id: true, email: true, name: true, role: true }
      })
      console.log('\n🏆 MANAGER PRINCIPAL:')
      console.log(`  Email: ${principal?.email}`)
      console.log(`  Nome: ${principal?.name}`)
      console.log(`  Role: ${principal?.role}`)
    }
  } else {
    console.log('\n⚠️  createdById é null — usuário não tem criador definido!')
  }

  // Também listar todos os sub-managers do principal (para contexto)
  if (elias.createdById) {
    const subManagers = await (prisma as any).users.findMany({
      where: {
        OR: [
          { managerPrincipalId: elias.createdById },
          { id: elias.createdById },
        ]
      },
      select: { id: true, email: true, role: true, managerPrincipalId: true }
    })
    console.log('\n📋 SUB-MANAGERS DO GRUPO:')
    subManagers.forEach((u: any) => {
      console.log(`  - ${u.email} [${u.role}] managerPrincipalId=${u.managerPrincipalId ?? 'null (é o principal)'}`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

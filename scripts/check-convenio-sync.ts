import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Convênios com email E userId, mas o user vinculado tem email diferente
  const convs = await prisma.convenio.findMany({
    where: { email: { not: null }, userId: { not: null } },
    select: { id: true, razao_soc: true, email: true, userId: true }
  })
  const desynced: any[] = []
  for (const c of convs) {
    const user = await prisma.users.findUnique({ where: { id: c.userId! }, select: { id: true, email: true, role: true } })
    if (!user || user.email?.toLowerCase() !== c.email?.toLowerCase()) {
      desynced.push({ convenioId: c.id, convenioEmail: c.email, userId: c.userId, userEmail: user?.email ?? 'NOT FOUND' })
    }
  }
  console.log('DESINCRONIZADOS:', desynced.length)
  if (desynced.length > 0) console.log(JSON.stringify(desynced, null, 2))

  // Usuários USER com senha pendente, não vinculados a nenhum convênio (potenciais órfãos)
  const allConvUserIds = (await prisma.convenio.findMany({
    where: { userId: { not: null } },
    select: { userId: true }
  })).map(c => c.userId!)

  const pendentes = await prisma.users.findMany({
    where: { role: 'USER', passwordChangedAt: null },
    select: { id: true, name: true, email: true, createdById: true }
  })

  const orphans = pendentes.filter(u => !allConvUserIds.includes(u.id))
  console.log('USERS PENDENTES DE SENHA:', pendentes.length)
  console.log('POSSÍVEIS ÓRFÃOS (não vinculados a convênio):', orphans.length)
  if (orphans.length > 0) console.log(JSON.stringify(orphans.slice(0, 10), null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())

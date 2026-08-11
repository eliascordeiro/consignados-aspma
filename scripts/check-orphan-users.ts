import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Buscar todos os convênios com email
  const convEmails = await prisma.convenio.findMany({
    where: { email: { not: null, not: '' } },
    select: { id: true, razao_soc: true, email: true, userId: true }
  })

  // Usuários USER vinculados a convênios
  const allConvUserIds = new Set(
    convEmails.filter(c => c.userId).map(c => c.userId!)
  )

  // Emails dos convênios
  const emailSet = new Map<string, typeof convEmails[0]>()
  for (const c of convEmails) {
    if (c.email) emailSet.set(c.email.toLowerCase(), c)
  }

  // Encontrar USERs com email igual a algum convênio mas que NÃO estão no userId do convênio
  const orphans: any[] = []
  for (const [email, conv] of emailSet) {
    const user = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, role: 'USER' },
      select: { id: true, name: true, email: true, createdById: true }
    })
    if (user && user.id !== conv.userId) {
      orphans.push({
        convenioId: conv.id,
        convenioRazao: conv.razao_soc,
        convenioEmail: conv.email,
        convenioUserId: conv.userId,
        orphanUserId: user.id,
        orphanUserName: user.name
      })
    }
  }

  console.log('ORPHANS (user com email do convênio mas não vinculado):', orphans.length)
  if (orphans.length > 0) console.log(JSON.stringify(orphans, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())

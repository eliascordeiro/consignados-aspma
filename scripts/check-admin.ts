import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' } },
})

async function main() {
  const u = await prisma.users.findFirst({
    where: { email: { equals: 'admin@consigexpress.com', mode: 'insensitive' } },
    select: { id: true, name: true, email: true, role: true, active: true, password: true },
  })
  console.log('USER:', JSON.stringify(u, null, 2))

  const rl = await prisma.loginAttempt.findMany({
    where: { key: { contains: 'consigexpress' } },
  })
  console.log('RATE_LIMIT:', JSON.stringify(rl, null, 2))

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

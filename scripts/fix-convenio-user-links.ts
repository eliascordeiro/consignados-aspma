import { PrismaClient } from '@prisma/client'

const DRY_RUN = !process.argv.includes('--apply')
const prisma = new PrismaClient()

async function main() {
  console.log(DRY_RUN ? '=== MODO DRY-RUN (use --apply para aplicar) ===' : '=== APLICANDO CORREÇÕES ===')

  // Buscar todos os convênios com email
  const convEmails = await prisma.convenio.findMany({
    where: { email: { not: null, not: '' } },
    select: { id: true, razao_soc: true, email: true, userId: true }
  })

  // Emails dos convênios
  const emailMap = new Map<string, typeof convEmails[0]>()
  for (const c of convEmails) {
    if (c.email) emailMap.set(c.email.toLowerCase(), c)
  }

  let fixed = 0
  let skipped = 0

  for (const [email, conv] of emailMap) {
    const user = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, role: 'USER' },
      select: { id: true, name: true, email: true }
    })
    // Só corrigir se o user existe, é diferente do userId atual e o userId atual não é o user correto
    if (user && user.id !== conv.userId) {
      console.log(`[FIX] Convênio ${conv.id} (${conv.razao_soc})`)
      console.log(`      email: ${conv.email}`)
      console.log(`      userId atual: ${conv.userId} → novo: ${user.id} (${user.name})`)

      if (!DRY_RUN) {
        await prisma.convenio.update({
          where: { id: conv.id },
          data: { userId: user.id }
        })
        // Não desativar o userId antigo aqui pois pode ser o MANAGER
      }
      fixed++
    } else {
      skipped++
    }
  }

  console.log(`\nRESUMO: ${fixed} corrigidos, ${skipped} sem alteração necessária`)
  if (DRY_RUN) console.log('Execute com --apply para aplicar as correções.')
}

main().catch(console.error).finally(() => prisma.$disconnect())

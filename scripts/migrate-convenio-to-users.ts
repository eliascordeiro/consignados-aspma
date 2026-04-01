/**
 * Migração: credenciais da tabela "convenio" → tabela "users"
 *
 * Para cada convênio (ativo ou inativo) com usuario+senha definidos:
 *   1. Verifica se já existe user vinculado (userId) ou com mesmo nome/email
 *   2. Se não existe → cria em "users" com role=USER
 *   3. Se existe mas password desatualizado → atualiza o hash
 *   4. Garante que convenio.userId aponta para o user correto
 *
 * Executar: npx tsx app/scripts/migrate-convenio-to-users.ts
 * (aponta sempre para Railway)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const RAILWAY_URL = 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'

const prisma = new PrismaClient({
  datasources: { db: { url: RAILWAY_URL } },
})

async function main() {
  console.log('🔄 Migrando credenciais de convênios para users...\n')

  const convenios = await prisma.convenio.findMany({
    where: {
      // ativos E inativos — migra todos com credenciais definidas
      senha: { not: null },
      usuario: { not: null },
    },
    select: {
      id: true,
      usuario: true,
      senha: true,
      email: true,
      razao_soc: true,
      fantasia: true,
      userId: true,
    },
    orderBy: { id: 'asc' },
  })

  console.log(`📋 ${convenios.length} convênios (ativos + inativos) com credenciais encontrados\n`)

  let criados = 0
  let atualizados = 0
  let jaOk = 0
  let erros = 0

  for (const convenio of convenios) {
    try {
      const senhaPlain = convenio.senha!
      const usuario = convenio.usuario!.trim()
      const email = convenio.email?.trim().toLowerCase()
      const emailGerado = (email || `${usuario.toLowerCase()}@convenio.local`)

      // Verifica se já existe user vinculado diretamente
      let user = convenio.userId
        ? await prisma.users.findUnique({
            where: { id: convenio.userId },
            select: { id: true, name: true, email: true, password: true, role: true, active: true },
          })
        : null

      // Se não encontrou pelo userId, procura por name ou email
      if (!user) {
        user = await prisma.users.findFirst({
          where: {
            OR: [
              { email: emailGerado },
              { name: { equals: usuario, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, email: true, password: true, role: true, active: true },
        })
      }

      const novoHash = await bcrypt.hash(senhaPlain, 10)

      if (!user) {
        // Criar novo user
        user = await prisma.users.create({
          data: {
            email: emailGerado,
            name: usuario,
            password: novoHash,
            role: 'USER',
            active: true,
            permissions: [],
          },
          select: { id: true, name: true, email: true, password: true, role: true, active: true },
        })
        criados++
        console.log(`  ✅ [CRIADO]    ${usuario} (${emailGerado})`)
      } else {
        // Verificar se hash bate; se não bate, atualizar
        const hashOk = await bcrypt.compare(senhaPlain, user.password)
        if (!hashOk) {
          await prisma.users.update({
            where: { id: user.id },
            data: { password: novoHash },
          })
          atualizados++
          console.log(`  🔄 [ATUALIZADO] ${usuario} — hash desatualizado corrigido`)
        } else {
          jaOk++
          console.log(`  ✓  [OK]        ${usuario}`)
        }
      }

      // Vincular convenio.userId se necessário
      if (convenio.userId !== user.id) {
        // Só atualiza se dono atual não é ADMIN/MANAGER
        let podeAtualizar = true
        if (convenio.userId) {
          const donoAtual = await prisma.users.findUnique({
            where: { id: convenio.userId },
            select: { role: true },
          })
          if (donoAtual?.role === 'ADMIN' || donoAtual?.role === 'MANAGER') {
            podeAtualizar = false
          }
        }
        if (podeAtualizar) {
          await prisma.convenio.update({
            where: { id: convenio.id },
            data: { userId: user.id },
          })
        }
      }
    } catch (err) {
      erros++
      console.error(`  ❌ [ERRO] convenio ${convenio.id} (${convenio.usuario}):`, err)
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('✅ MIGRAÇÃO CONCLUÍDA')
  console.log('═'.repeat(60))
  console.log(`  Criados:     ${criados}`)
  console.log(`  Atualizados: ${atualizados}`)
  console.log(`  Já OK:       ${jaOk}`)
  console.log(`  Erros:       ${erros}`)
  console.log('═'.repeat(60))
}

main()
  .catch(err => { console.error('Erro fatal:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())

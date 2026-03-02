/**
 * fix-celular-socios.ts
 *
 * Padroniza o campo `celular` na tabela `socios`:
 *  - Números com 8 dígitos (ex: "9612 3839")  → "419" + dígitos = "41996123839"
 *  - Números com 10-11 dígitos já com DDD       → normaliza para dígitos puros
 *  - Demais (lixo)                              → ignora
 *
 * Uso:
 *   Dry-run (só mostra o que vai mudar):
 *     npx tsx scripts/fix-celular-socios.ts
 *
 *   Aplicar de verdade:
 *     npx tsx scripts/fix-celular-socios.ts --apply
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = !process.argv.includes('--apply')

const RED   = '\x1b[31m'
const GRN   = '\x1b[32m'
const YEL   = '\x1b[33m'
const CYN   = '\x1b[36m'
const RST   = '\x1b[0m'
const DIM   = '\x1b[2m'

function normalizar(v: string): string {
  return v.replace(/\D/g, '')
}

async function main() {
  console.log(`\n${CYN}=== fix-celular-socios.ts ===${RST}`)
  console.log(DRY_RUN ? `${YEL}[DRY-RUN] Nenhuma alteração será feita. Use --apply para aplicar.${RST}\n`
                       : `${RED}[APPLY] Atualizando o banco de dados...${RST}\n`)

  const socios = await prisma.socio.findMany({
    where: { celular: { not: null } },
    select: { id: true, nome: true, celular: true },
  })

  let skip = 0
  let ignore = 0
  let update = 0

  const changes: Array<{ id: string; nome: string; de: string; para: string }> = []

  for (const s of socios) {
    const raw = s.celular!
    const digits = normalizar(raw)
    const n = digits.length

    if (n === 0) { ignore++; continue }

    let novo: string | null = null

    if (n === 8) {
      // Ex: "9612 3839" → "41996123839"
      novo = `419${digits}`
    } else if (n === 9) {
      // Ex: "996123839" — falta DDD, complementa com 41
      novo = `41${digits}`
    } else if (n === 10) {
      // DDD + 8 dígitos — pode precisar inserir o 9 após DDD
      const ddd = digits.slice(0, 2)
      const rest = digits.slice(2)
      // Se o 1º dígito do número local não é 9, insere
      novo = rest.startsWith('9') ? digits : `${ddd}9${rest}`
    } else if (n === 11) {
      // Já no formato esperado — só normaliza para dígitos puros
      novo = digits
    } else if (n === 12 && digits.startsWith('55')) {
      // DDI 55 já incluído — mantém sem DDI (API adiciona)
      novo = digits.slice(2)
    } else {
      // Quantidade de dígitos estranha — ignora
      ignore++
      continue
    }

    if (novo === raw) {
      skip++
      continue
    }

    changes.push({ id: s.id, nome: s.nome, de: raw, para: novo })
  }

  // Exibe resumo
  const groups: Record<number, number> = {}
  for (const c of changes) {
    const n = normalizar(c.de).length
    groups[n] = (groups[n] || 0) + 1
  }
  console.log(`${CYN}Distribuição dos registros a atualizar:${RST}`)
  for (const [g, cnt] of Object.entries(groups).sort()) {
    console.log(`  ${g} dígitos: ${cnt} registros`)
  }
  console.log(`  Já corretos (sem mudança): ${skip}`)
  console.log(`  Ignorados (dígitos inválidos): ${ignore}`)
  console.log(`  TOTAL a atualizar: ${changes.length}\n`)

  // Amostra
  const sample = changes.slice(0, 20)
  console.log(`${CYN}Amostra (primeiros ${sample.length}):${RST}`)
  for (const c of sample) {
    console.log(`  ${DIM}${c.nome.slice(0, 30).padEnd(30)}${RST}  "${YEL}${c.de}${RST}" → "${GRN}${c.para}${RST}"`)
  }
  if (changes.length > 20) {
    console.log(`  ${DIM}... e mais ${changes.length - 20} registros${RST}`)
  }

  if (DRY_RUN) {
    console.log(`\n${YEL}Dry-run concluído. Rode com --apply para aplicar.${RST}`)
    return
  }

  // Aplica em batches de 200
  const BATCH = 200
  let done = 0
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH)
    await Promise.all(
      batch.map(c =>
        prisma.socio.update({
          where: { id: c.id },
          data: { celular: c.para },
        })
      )
    )
    done += batch.length
    process.stdout.write(`\r  ${GRN}Atualizados: ${done}/${changes.length}${RST}    `)
  }
  console.log(`\n\n${GRN}✓ Concluído! ${changes.length} registros atualizados.${RST}\n`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

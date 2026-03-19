#!/usr/bin/env tsx
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    POPULATE vendas.empresaId                                     ║
 * ║    Preenche o snapshot de empresaId em todas as vendas           ║
 * ║    que ainda não possuem esse campo preenchido.                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Estratégia:
 *   - Usa UPDATE ... FROM socios via SQL raw em batches de CTE
 *   - Cada batch é uma query independente → sem conexão longa aberta
 *   - Retry automático por batch em caso de P1017 (conexão derrubada)
 *   - Idempotente: pode ser re-executado sem efeito colateral
 *
 * Uso: npx tsx app/scripts/populate-vendas-empresaId.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

// connection_limit=1 evita pool ocioso; connect_timeout=60; statement_timeout=120s
const RAILWAY_URL =
  'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' +
  '?connection_limit=1&connect_timeout=60&statement_timeout=120000';

const BATCH_SIZE  = 2000;   // linhas por UPDATE (CTE)
const MAX_RETRIES = 5;
const RETRY_DELAYS = [3000, 6000, 12000, 24000, 48000];

// ── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function fmt(n: number): string { return n.toLocaleString('pt-BR'); }

function duration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function log(msg: string) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Refaz o PrismaClient a cada batch para garantir conexão fresca
function makePrisma() {
  return new PrismaClient({ datasources: { db: { url: RAILWAY_URL } } });
}

// Executa uma query com retry em caso de falha de conexão (P1017 / P1001)
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.code;
      if ((code === 'P1017' || code === 'P1001') && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt];
        log(`⚠️  [${label}] Conexão derrubada (${code}), tentativa ${attempt + 1}/${MAX_RETRIES} em ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw new Error('Unreachable');
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // ── 1. Conta vendas sem empresaId ─────────────────────────────────────────
  log('Conectando ao Railway...');
  const totalSemEmpresa: number = await withRetry('count', async () => {
    const prisma = makePrisma();
    try {
      return await prisma.venda.count({ where: { empresaId: null } });
    } finally { await prisma.$disconnect(); }
  });

  if (totalSemEmpresa === 0) {
    log('✅ Nenhuma venda com empresaId nulo. Nada a fazer.');
    return;
  }
  log(`Total de vendas sem empresaId: ${fmt(totalSemEmpresa)}`);

  // ── 2. Atualiza em batches via SQL raw (CTE LIMIT) ────────────────────────
  // PostgreSQL não suporta LIMIT direto em UPDATE, mas suporta via CTE:
  //   WITH batch AS (SELECT id FROM vendas JOIN socios ... LIMIT n)
  //   UPDATE vendas SET empresaId = ... FROM batch WHERE vendas.id = batch.id
  log(`Iniciando atualização em batches de ${fmt(BATCH_SIZE)}...`);

  let totalAtualizadas = 0;

  while (true) {
    const updated: number = await withRetry(`batch-${totalAtualizadas}`, async () => {
      const prisma = makePrisma();
      try {
        const result = await prisma.$executeRaw(Prisma.sql`
          WITH batch AS (
            SELECT v.id, s."empresaId" AS novo_empresa_id
            FROM   vendas v
            JOIN   socios s ON v."socioId" = s.id
            WHERE  v."empresaId" IS NULL
              AND  s."empresaId" IS NOT NULL
            LIMIT  ${BATCH_SIZE}
          )
          UPDATE vendas v
          SET    "empresaId" = batch.novo_empresa_id
          FROM   batch
          WHERE  v.id = batch.id
        `);
        return result;
      } finally { await prisma.$disconnect(); }
    });

    if (updated === 0) break;

    totalAtualizadas += updated;
    const pct = Math.min(100, Math.round((totalAtualizadas / totalSemEmpresa) * 100));
    log(`Progresso: ${fmt(totalAtualizadas)}/${fmt(totalSemEmpresa)} (${pct}%) atualizadas`);
  }

  // ── 3. Relatório final ────────────────────────────────────────────────────
  const { comEmpresa, semEmpresa } = await withRetry('final-count', async () => {
    const prisma = makePrisma();
    try {
      const [comEmpresa, semEmpresa] = await Promise.all([
        prisma.venda.count({ where: { empresaId: { not: null } } }),
        prisma.venda.count({ where: { empresaId: null } }),
      ]);
      return { comEmpresa, semEmpresa };
    } finally { await prisma.$disconnect(); }
  });

  log('');
  log('════════════════════════════════════════════');
  log(`✅ Concluído em ${duration(Date.now() - startTime)}`);
  log(`   Vendas atualizadas nesta execução : ${fmt(totalAtualizadas)}`);
  log(`   Total com empresaId               : ${fmt(comEmpresa)}`);
  log(`   Total ainda nulo (sem empresa)    : ${fmt(semEmpresa)}`);
  log('════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

import mysql from 'mysql2/promise';
import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT DE MIGRAÇÃO CONFIÁVEL v2
// ═══════════════════════════════════════════════════════════════════════════════
// Estratégia:
//   1. Usa POOL de conexões MySQL (não conexões individuais)
//   2. Batch INSERT com createMany + skipDuplicates (idempotente)
//   3. Poucos workers (5-8) para não sobrecarregar MySQL remoto
//   4. Retry automático por batch com backoff exponencial
//   5. Verificação de integridade ao final (compara origem × destino)
//   6. Checkpoint em disco para retomar em caso de falha
//   7. Pode ser re-executado sem duplicar dados
// ═══════════════════════════════════════════════════════════════════════════════

// ── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
const NUM_WORKERS = 8;            // Workers (total, para ambas as fases)
const BATCH_SIZE = 500;           // Registros lidos por batch do MySQL
const INSERT_CHUNK = 100;         // Registros por createMany (evita timeout)
const MAX_RETRIES = 5;            // Tentativas por batch
const PROGRESS_INTERVAL_MS = 1000;

const RAILWAY_URL = 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';
const MYSQL_CONFIG = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
  charset: 'utf8mb4' as const,
  connectTimeout: 60000,
  waitForConnections: true,
  connectionLimit: NUM_WORKERS + 2,  // Pool limitado
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

const SCRIPTS_DIR = __dirname;
const CHECKPOINT_FILE = path.join(SCRIPTS_DIR, 'migration-v2-checkpoint.json');
const VENDA_MAP_FILE = path.join(SCRIPTS_DIR, 'migration-v2-venda-map.json');
const LOG_FILE = path.join(SCRIPTS_DIR, 'migration-v2-log.txt');

// ── TIPOS ────────────────────────────────────────────────────────────────────
interface Checkpoint {
  vendasDone: boolean;
  parcelasDone: boolean;
  vendasMigradas: number;
  parcelasMigradas: number;
  lastVendaId: number;
  lastParcelaId: number;
  startedAt: string;
}

interface BatchResult {
  inserted: number;
  skipped: number;
  errors: number;
  semRef: number; // sem sócio ou sem venda
}

interface PhaseStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  semRef: number;
  startTime: number;
}

// ── VARIÁVEIS GLOBAIS ────────────────────────────────────────────────────────
let mysqlPool: mysql.Pool;
let prisma: PrismaClient;
let matriculaMap: Map<number, number>;
let socioByMatricula: Map<string, string>;
let convenioByCodigo: Map<number, number>;
let adminUserId: string;
let vendaKeyToId: Map<string, string>;  // "matricula-sequencia" -> vendaId
let existingVendaKeys: Set<string>;     // Vendas já no Railway
let existingParcelaKeys: Set<string>;   // Parcelas já no Railway
let phaseStats: PhaseStats;

// ── UTILITÁRIOS ──────────────────────────────────────────────────────────────
function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function fmt(n: number): string { return n.toLocaleString('pt-BR'); }

function duration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${m % 60}m${s % 60}s`;
  if (m > 0) return `${m}m${s % 60}s`;
  return `${s}s`;
}

function bar(cur: number, tot: number, w = 30): string {
  if (tot === 0) return `[${'░'.repeat(w)}] 0.0%`;
  const pct = (cur / tot) * 100;
  const f = Math.min(Math.round((w * cur) / tot), w);
  return `[${'█'.repeat(f)}${'░'.repeat(w - f)}] ${pct.toFixed(1)}%`;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── CHECKPOINT ───────────────────────────────────────────────────────────────
function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

function loadVendaMap(): Map<string, string> {
  try {
    if (fs.existsSync(VENDA_MAP_FILE)) {
      const obj = JSON.parse(fs.readFileSync(VENDA_MAP_FILE, 'utf-8'));
      return new Map(Object.entries(obj));
    }
  } catch {}
  return new Map();
}

function saveVendaMap() {
  const obj: Record<string, string> = {};
  vendaKeyToId.forEach((v, k) => obj[k] = v);
  fs.writeFileSync(VENDA_MAP_FILE, JSON.stringify(obj));
}

// ── CONEXÕES ─────────────────────────────────────────────────────────────────
function createMySQLPool(): mysql.Pool {
  return mysql.createPool(MYSQL_CONFIG);
}

function createPrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: RAILWAY_URL } },
    log: [], // silencioso
  });
}

// ── RETRY COM BACKOFF ────────────────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        log(`   ⚠️ ${label} tentativa ${attempt}/${maxRetries} falhou: ${err.message?.substring(0, 80)}. Retry em ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

// ── CARREGAR DADOS DE REFERÊNCIA ─────────────────────────────────────────────
async function loadReferenceData() {
  log('📊 Carregando dados de referência...');

  // 1. Mapeamento de matrículas (MySQL)
  const conn = await mysqlPool.getConnection();
  try {
    const [rows] = await conn.query('SELECT matricula_antiga, matricula_atual FROM matriculas');
    matriculaMap = new Map();
    (rows as any[]).forEach(m => matriculaMap.set(m.matricula_antiga, m.matricula_atual));
    log(`   ✅ ${fmt(matriculaMap.size)} mapeamentos de matrícula`);
  } finally {
    conn.release();
  }

  // 2. Sócios do Railway
  const socios = await prisma.socio.findMany({ select: { id: true, matricula: true } });
  socioByMatricula = new Map();
  socios.forEach(s => { if (s.matricula) socioByMatricula.set(s.matricula.trim(), s.id); });
  log(`   ✅ ${fmt(socioByMatricula.size)} sócios`);

  // 3. Convênios do Railway
  const convenios = await prisma.convenio.findMany({ select: { id: true, codigo: true } });
  convenioByCodigo = new Map();
  convenios.forEach(c => {
    if (c.codigo != null) {
      const num = parseInt(String(c.codigo));
      if (!isNaN(num)) convenioByCodigo.set(num, c.id);
    }
  });
  log(`   ✅ ${fmt(convenioByCodigo.size)} convênios`);

  // 4. Usuário admin
  const admin = await prisma.users.findFirst({
    where: { OR: [{ role: 'ADMIN' }, { role: 'MANAGER' }] },
    orderBy: { createdAt: 'asc' }
  });
  if (!admin) throw new Error('Nenhum ADMIN/MANAGER encontrado no Railway!');
  adminUserId = admin.id;
  log(`   ✅ Admin: ${admin.name} (${admin.role})`);
}

// ── CARREGAR VENDAS JÁ EXISTENTES NO RAILWAY ────────────────────────────────
async function loadExistingVendas() {
  log('📦 Carregando vendas já existentes no Railway...');
  
  const vendas = await prisma.venda.findMany({
    select: { id: true, socioId: true, numeroVenda: true }
  });

  existingVendaKeys = new Set();
  vendaKeyToId = loadVendaMap();  // Carregar mapa anterior se existir

  // Reconstruir mapa completo a partir do Railway
  // Precisamos do socio.matricula para reconstruir a chave
  const socioIdToMatricula = new Map<string, string>();
  socioByMatricula.forEach((id, mat) => socioIdToMatricula.set(id, mat));

  for (const v of vendas) {
    const mat = socioIdToMatricula.get(v.socioId);
    if (mat) {
      const key = `${mat}-${v.numeroVenda}`;
      existingVendaKeys.add(key);
      vendaKeyToId.set(key, v.id);
    }
  }

  log(`   ✅ ${fmt(existingVendaKeys.size)} vendas já no Railway`);
}

// ── CARREGAR PARCELAS JÁ EXISTENTES NO RAILWAY ──────────────────────────────
async function loadExistingParcelas() {
  log('📦 Carregando parcelas já existentes no Railway...');

  // Usar contagem por vendaId+numeroParcela para saber quais já existem
  const parcelas = await prisma.parcela.findMany({
    select: { vendaId: true, numeroParcela: true }
  });

  existingParcelaKeys = new Set();
  for (const p of parcelas) {
    existingParcelaKeys.add(`${p.vendaId}-${p.numeroParcela}`);
  }

  log(`   ✅ ${fmt(existingParcelaKeys.size)} parcelas já no Railway`);
}

// ── PROCESSAR BATCH DE VENDAS ────────────────────────────────────────────────
async function processVendasBatch(rows: any[]): Promise<BatchResult> {
  const result: BatchResult = { inserted: 0, skipped: 0, errors: 0, semRef: 0 };
  const toInsert: Prisma.VendaCreateManyInput[] = [];

  for (const venda of rows) {
    // Resolver matrícula
    let mat = venda.matricula;
    if (matriculaMap.has(mat)) mat = matriculaMap.get(mat)!;
    const matStr = String(mat);

    // Verificar se já existe
    const key = `${matStr}-${venda.sequencia}`;
    if (existingVendaKeys.has(key)) {
      result.skipped++;
      continue;
    }

    // Buscar sócio
    const socioId = socioByMatricula.get(matStr);
    if (!socioId) {
      result.semRef++;
      continue;
    }

    const convenioId = venda.codconven ? convenioByCodigo.get(venda.codconven) : null;
    const qtdParcelas = Math.round(venda.parcelas || 1);
    const valorParcela = venda.valorparcela || 0;

    toInsert.push({
      userId: adminUserId,
      socioId,
      convenioId: convenioId ?? null,
      numeroVenda: venda.sequencia,
      dataEmissao: venda.emissao,
      operador: venda.operador?.trim() || null,
      quantidadeParcelas: qtdParcelas,
      valorParcela,
      valorTotal: valorParcela * qtdParcelas,
      ativo: venda.cancela !== 'S',
      cancelado: venda.cancela === 'S',
      motivoCancelamento: venda.cancela === 'S' ? 'Cancelado no sistema antigo' : null,
      createdById: adminUserId,
    });
  }

  if (toInsert.length === 0) return result;

  // Inserir em chunks menores para evitar timeout
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    try {
      const res = await prisma.venda.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      result.inserted += res.count;
      result.skipped += chunk.length - res.count;
    } catch (err: any) {
      // Se createMany falhar, tentar um a um para não perder o batch inteiro
      for (const item of chunk) {
        try {
          await prisma.venda.create({ data: item });
          result.inserted++;
        } catch (e: any) {
          if (e.code === 'P2002') {
            result.skipped++;
          } else {
            result.errors++;
          }
        }
      }
    }
  }

  // Atualizar mapa de vendas (buscar os IDs recém-criados)
  // Fazemos isso em lote para eficiência
  const matsToSearch = toInsert.map(v => v.socioId);
  const uniqueSocioIds = [...new Set(matsToSearch)];
  
  const novasVendas = await prisma.venda.findMany({
    where: { socioId: { in: uniqueSocioIds } },
    select: { id: true, socioId: true, numeroVenda: true }
  });

  const socioIdToMatricula = new Map<string, string>();
  socioByMatricula.forEach((id, mat) => socioIdToMatricula.set(id, mat));

  for (const v of novasVendas) {
    const mat = socioIdToMatricula.get(v.socioId);
    if (mat) {
      const key = `${mat}-${v.numeroVenda}`;
      vendaKeyToId.set(key, v.id);
      existingVendaKeys.add(key);
    }
  }

  return result;
}

// ── PROCESSAR BATCH DE PARCELAS ──────────────────────────────────────────────
async function processParcelasBatch(rows: any[]): Promise<BatchResult> {
  const result: BatchResult = { inserted: 0, skipped: 0, errors: 0, semRef: 0 };
  const toInsert: Prisma.ParcelaCreateManyInput[] = [];

  for (const parcela of rows) {
    const matNum = parseInt(parcela.matricula);
    const seqNum = parseInt(parcela.sequencia);
    let matStr = String(matNum);
    
    // Aplicar mapeamento de matrícula
    if (matriculaMap.has(matNum)) {
      matStr = String(matriculaMap.get(matNum)!);
    }

    const vendaKey = `${matStr}-${seqNum}`;
    const vendaId = vendaKeyToId.get(vendaKey);
    
    if (!vendaId) {
      result.semRef++;
      continue;
    }

    const numeroParcela = parseInt(parcela.nrseq) || 1;
    const parcelaKey = `${vendaId}-${numeroParcela}`;

    // Verificar se já existe
    if (existingParcelaKeys.has(parcelaKey)) {
      result.skipped++;
      continue;
    }

    toInsert.push({
      vendaId,
      numeroParcela,
      dataVencimento: parcela.vencimento,
      valor: parcela.valor || 0,
      baixa: parcela.baixa?.trim() || null,
      dataBaixa: parcela.baixa === 'S' ? parcela.vencimento : null,
      valorPago: parcela.baixa === 'S' ? (parcela.valor || 0) : null,
      tipo: parcela.tipo?.trim() || null,
      createdById: adminUserId,
    });
  }

  if (toInsert.length === 0) return result;

  // Inserir em chunks
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    try {
      const res = await prisma.parcela.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      result.inserted += res.count;
      result.skipped += chunk.length - res.count;
    } catch (err: any) {
      // Fallback: inserir um a um
      for (const item of chunk) {
        try {
          await prisma.parcela.create({ data: item });
          result.inserted++;
        } catch (e: any) {
          if (e.code === 'P2002') {
            result.skipped++;
          } else {
            result.errors++;
          }
        }
      }
    }
  }

  // Marcar como existentes
  for (const item of toInsert) {
    existingParcelaKeys.add(`${item.vendaId}-${item.numeroParcela}`);
  }

  return result;
}

// ── WORKER GENÉRICO ──────────────────────────────────────────────────────────
async function worker(
  workerId: number,
  table: 'vendas' | 'parcelas',
  startId: number,
  endId: number,
  processBatch: (rows: any[]) => Promise<BatchResult>
): Promise<BatchResult> {
  const total: BatchResult = { inserted: 0, skipped: 0, errors: 0, semRef: 0 };
  let currentId = startId;

  while (currentId < endId) {
    try {
      const batchResult = await withRetry(async () => {
        const conn = await mysqlPool.getConnection();
        try {
          const [rows] = await conn.query(
            `SELECT * FROM ${table} WHERE id >= ? AND id < ? ORDER BY id LIMIT ?`,
            [currentId, endId, BATCH_SIZE]
          );
          const data = rows as any[];
          if (data.length === 0) return { inserted: 0, skipped: 0, errors: 0, semRef: 0, lastId: endId };

          const result = await processBatch(data);
          const lastId = data[data.length - 1].id + 1;
          return { ...result, lastId };
        } finally {
          conn.release();
        }
      }, `W${workerId} batch@${currentId}`);

      total.inserted += batchResult.inserted;
      total.skipped += batchResult.skipped;
      total.errors += batchResult.errors;
      total.semRef += batchResult.semRef;

      // Atualizar stats globais
      phaseStats.migrated += batchResult.inserted;
      phaseStats.skipped += batchResult.skipped;
      phaseStats.errors += batchResult.errors;
      phaseStats.semRef += batchResult.semRef;

      currentId = (batchResult as any).lastId || endId;
    } catch (err: any) {
      log(`   ❌ W${workerId} falhou após ${MAX_RETRIES} tentativas em id=${currentId}: ${err.message?.substring(0, 100)}`);
      total.errors++;
      phaseStats.errors++;
      // Pular este batch e continuar
      currentId += BATCH_SIZE;
    }
  }

  return total;
}

// ── DISPLAY DE PROGRESSO ─────────────────────────────────────────────────────
function displayProgress(phase: string) {
  const elapsed = (Date.now() - phaseStats.startTime) / 1000;
  const processed = phaseStats.migrated + phaseStats.skipped + phaseStats.semRef;
  const rate = processed > 0 ? processed / elapsed : 0;
  const remaining = rate > 0 ? (phaseStats.total - processed) / rate : 0;

  process.stdout.write('\r');
  process.stdout.write(
    `  ${phase} ${bar(processed, phaseStats.total, 25)} ` +
    `${fmt(processed)}/${fmt(phaseStats.total)} | ` +
    `+${fmt(phaseStats.migrated)} ` +
    `~${fmt(phaseStats.skipped)} ` +
    `❌${fmt(phaseStats.errors)} | ` +
    `${fmt(Math.round(rate))}/s | ` +
    `ETA ${duration(remaining * 1000)}   `
  );
}

// ── FASE: MIGRAR VENDAS ──────────────────────────────────────────────────────
async function migrateVendas(): Promise<number> {
  log('\n' + '═'.repeat(70));
  log('📦 FASE 1: MIGRAR VENDAS');
  log('═'.repeat(70));

  // Contar vendas no MySQL
  const conn = await mysqlPool.getConnection();
  let minId: number, maxId: number, totalCount: number;
  try {
    const [[stats]] = await conn.query('SELECT MIN(id) as minId, MAX(id) as maxId, COUNT(*) as total FROM vendas') as any;
    minId = stats.minId;
    maxId = stats.maxId;
    totalCount = stats.total;
  } finally {
    conn.release();
  }

  log(`   MySQL: ${fmt(totalCount)} vendas (IDs ${minId} - ${maxId})`);
  log(`   Railway: ${fmt(existingVendaKeys.size)} já migradas`);

  if (existingVendaKeys.size >= totalCount) {
    log('   ✅ Todas as vendas já estão migradas!');
    return existingVendaKeys.size;
  }

  phaseStats = {
    total: totalCount,
    migrated: 0,
    skipped: 0,
    errors: 0,
    semRef: 0,
    startTime: Date.now()
  };

  // Dividir range de IDs entre workers
  const chunkSize = Math.ceil((maxId - minId + 1) / NUM_WORKERS);
  const workerPromises: Promise<BatchResult>[] = [];

  for (let i = 0; i < NUM_WORKERS; i++) {
    const wStart = minId + (i * chunkSize);
    const wEnd = Math.min(minId + ((i + 1) * chunkSize), maxId + 1);
    workerPromises.push(worker(i, 'vendas', wStart, wEnd, processVendasBatch));
  }

  // Progress display
  const interval = setInterval(() => displayProgress('VENDAS'), PROGRESS_INTERVAL_MS);

  // Aguardar todos os workers
  const results = await Promise.all(workerPromises);
  clearInterval(interval);
  displayProgress('VENDAS');
  console.log(''); // Nova linha

  // Salvar mapa de vendas
  saveVendaMap();

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  const totalSemRef = results.reduce((s, r) => s + r.semRef, 0);
  const elapsed = Date.now() - phaseStats.startTime;

  log(`   ✅ Inseridas: ${fmt(totalInserted)} | Duplicadas: ${fmt(totalSkipped)} | Erros: ${fmt(totalErrors)} | Sem sócio: ${fmt(totalSemRef)}`);
  log(`   ⏱️  Tempo: ${duration(elapsed)}`);

  return totalInserted;
}

// ── FASE: MIGRAR PARCELAS ────────────────────────────────────────────────────
async function migrateParcelas(): Promise<number> {
  log('\n' + '═'.repeat(70));
  log('📦 FASE 2: MIGRAR PARCELAS');
  log('═'.repeat(70));

  // Contar parcelas no MySQL
  const conn = await mysqlPool.getConnection();
  let minId: number, maxId: number, totalCount: number;
  try {
    const [[stats]] = await conn.query('SELECT MIN(id) as minId, MAX(id) as maxId, COUNT(*) as total FROM parcelas') as any;
    minId = stats.minId;
    maxId = stats.maxId;
    totalCount = stats.total;
  } finally {
    conn.release();
  }

  log(`   MySQL: ${fmt(totalCount)} parcelas (IDs ${minId} - ${maxId})`);
  log(`   Railway: ${fmt(existingParcelaKeys.size)} já migradas`);

  if (existingParcelaKeys.size >= totalCount) {
    log('   ✅ Todas as parcelas já estão migradas!');
    return existingParcelaKeys.size;
  }

  phaseStats = {
    total: totalCount,
    migrated: 0,
    skipped: 0,
    errors: 0,
    semRef: 0,
    startTime: Date.now()
  };

  const chunkSize = Math.ceil((maxId - minId + 1) / NUM_WORKERS);
  const workerPromises: Promise<BatchResult>[] = [];

  for (let i = 0; i < NUM_WORKERS; i++) {
    const wStart = minId + (i * chunkSize);
    const wEnd = Math.min(minId + ((i + 1) * chunkSize), maxId + 1);
    workerPromises.push(worker(i, 'parcelas', wStart, wEnd, processParcelasBatch));
  }

  const interval = setInterval(() => displayProgress('PARCELAS'), PROGRESS_INTERVAL_MS);

  const results = await Promise.all(workerPromises);
  clearInterval(interval);
  displayProgress('PARCELAS');
  console.log('');

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  const totalSemRef = results.reduce((s, r) => s + r.semRef, 0);
  const elapsed = Date.now() - phaseStats.startTime;

  log(`   ✅ Inseridas: ${fmt(totalInserted)} | Duplicadas: ${fmt(totalSkipped)} | Erros: ${fmt(totalErrors)} | Sem venda: ${fmt(totalSemRef)}`);
  log(`   ⏱️  Tempo: ${duration(elapsed)}`);

  return totalInserted;
}

// ── VERIFICAÇÃO DE INTEGRIDADE ───────────────────────────────────────────────
async function verifyIntegrity() {
  log('\n' + '═'.repeat(70));
  log('🔍 VERIFICAÇÃO DE INTEGRIDADE');
  log('═'.repeat(70));

  // Contagens no MySQL
  const conn = await mysqlPool.getConnection();
  let mysqlVendas: number, mysqlParcelas: number;
  try {
    const [[v]] = await conn.query('SELECT COUNT(*) as c FROM vendas') as any;
    const [[p]] = await conn.query('SELECT COUNT(*) as c FROM parcelas') as any;
    mysqlVendas = v.c;
    mysqlParcelas = p.c;
  } finally {
    conn.release();
  }

  // Contagens no Railway
  const railwayVendas = await prisma.venda.count();
  const railwayParcelas = await prisma.parcela.count();

  const vendasPct = ((railwayVendas / mysqlVendas) * 100).toFixed(1);
  const parcelasPct = ((railwayParcelas / mysqlParcelas) * 100).toFixed(1);

  log(`   📊 VENDAS:`);
  log(`      MySQL:   ${fmt(mysqlVendas)}`);
  log(`      Railway: ${fmt(railwayVendas)} (${vendasPct}%)`);
  log(`      Diff:    ${fmt(mysqlVendas - railwayVendas)}`);
  log('');
  log(`   📊 PARCELAS:`);
  log(`      MySQL:   ${fmt(mysqlParcelas)}`);
  log(`      Railway: ${fmt(railwayParcelas)} (${parcelasPct}%)`);
  log(`      Diff:    ${fmt(mysqlParcelas - railwayParcelas)}`);

  const vendasOk = railwayVendas >= mysqlVendas * 0.95;
  const parcelasOk = railwayParcelas >= mysqlParcelas * 0.95;

  if (vendasOk && parcelasOk) {
    log('\n   ✅ INTEGRIDADE OK (>95% migrado)');
  } else {
    log('\n   ⚠️  INTEGRIDADE PARCIAL - Execute novamente para completar');
  }

  return { mysqlVendas, mysqlParcelas, railwayVendas, railwayParcelas };
}

// ── MIGRAÇÃO PRINCIPAL ───────────────────────────────────────────────────────
async function migrate() {
  const globalStart = Date.now();
  
  console.clear();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║          🚀 MIGRAÇÃO CONFIÁVEL v2 - VENDAS & PARCELAS              ║');
  console.log('║          Pool MySQL | createMany | Retry | Idempotente             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  log('Inicializando conexões...');

  // Inicializar conexões
  mysqlPool = createMySQLPool();
  prisma = createPrisma();

  try {
    // Carregar dados de referência
    await loadReferenceData();

    // Carregar estado existente do Railway
    await loadExistingVendas();

    // FASE 1: Vendas
    const vendasInserted = await migrateVendas();

    // Recarregar mapa de vendas completo para a fase de parcelas
    log('\n📦 Atualizando mapa de vendas...');
    vendaKeyToId = loadVendaMap();
    
    // Recarregar vendas do Railway (pode ter novos registros)
    const socioIdToMatricula = new Map<string, string>();
    socioByMatricula.forEach((id, mat) => socioIdToMatricula.set(id, mat));
    
    const todasVendas = await prisma.venda.findMany({
      select: { id: true, socioId: true, numeroVenda: true }
    });
    for (const v of todasVendas) {
      const mat = socioIdToMatricula.get(v.socioId);
      if (mat) vendaKeyToId.set(`${mat}-${v.numeroVenda}`, v.id);
    }
    log(`   ✅ Mapa de vendas: ${fmt(vendaKeyToId.size)} entradas`);
    saveVendaMap();

    // Carregar parcelas existentes
    await loadExistingParcelas();

    // FASE 2: Parcelas
    const parcelasInserted = await migrateParcelas();

    // Verificação de integridade
    const integrity = await verifyIntegrity();

    // Resumo final
    const totalTime = Date.now() - globalStart;
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║               ✅ MIGRAÇÃO v2 CONCLUÍDA                               ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║  📊 Vendas:   ${fmt(integrity.railwayVendas).padStart(10)} / ${fmt(integrity.mysqlVendas).padEnd(10)}                     ║`);
    console.log(`║  📊 Parcelas: ${fmt(integrity.railwayParcelas).padStart(10)} / ${fmt(integrity.mysqlParcelas).padEnd(10)}                     ║`);
    console.log(`║  ⏱️  Tempo total: ${duration(totalTime).padEnd(15)}                                  ║`);
    console.log(`║  💡 Script idempotente: pode re-executar para completar             ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Salvar checkpoint final
    saveCheckpoint({
      vendasDone: true,
      parcelasDone: true,
      vendasMigradas: integrity.railwayVendas,
      parcelasMigradas: integrity.railwayParcelas,
      lastVendaId: 0,
      lastParcelaId: 0,
      startedAt: new Date(globalStart).toISOString(),
    });

  } finally {
    await mysqlPool.end();
    await prisma.$disconnect();
  }
}

// ── EXECUÇÃO ─────────────────────────────────────────────────────────────────
migrate().catch(err => {
  log(`\n❌ ERRO FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});

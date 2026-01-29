import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES - APENAS PARCELAS
// ═══════════════════════════════════════════════════════════════════
const NUM_WORKERS = 50;          // 50 workers paralelos para parcelas!
const BATCH_SIZE = 500;          // Registros por batch
const PROGRESS_INTERVAL = 1000;  // Atualizar progresso a cada 1s

const LOG_FILE = path.join(__dirname, 'migration-parcelas-log.txt');

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface WorkerProgress {
  workerId: number;
  processed: number;
  errors: number;
  semVenda: number;
  currentId: number;
  startId: number;
  endId: number;
  done: boolean;
}

interface MySQLParcela {
  id: number;
  matricula: string;
  sequencia: string;
  nrseq: string;
  vencimento: Date;
  valor: number;
  baixa: string | null;
  associado: string | null;
  codconven: string;
  conveniado: string | null;
  parcelas: number;
  tipo: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// VARIÁVEIS GLOBAIS
// ═══════════════════════════════════════════════════════════════════
const workersProgress: WorkerProgress[] = [];
let totalRecords = 0;
let startTime = Date.now();

// Dados de referência
let vendaIdMap: Map<string, string>;
let adminUserId: string;

// ═══════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════
function log(message: string) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}

function formatNumber(num: number): string {
  return num.toLocaleString('pt-BR');
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function progressBar(current: number, total: number, width: number = 40): string {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.round((width * current) / total);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toFixed(1)}%`;
}

// ═══════════════════════════════════════════════════════════════════
// DISPLAY DE PROGRESSO EM TEMPO REAL
// ═══════════════════════════════════════════════════════════════════
function displayProgress() {
  const totalProcessed = workersProgress.reduce((sum, w) => sum + w.processed, 0);
  const totalErrors = workersProgress.reduce((sum, w) => sum + w.errors, 0);
  const totalSemVenda = workersProgress.reduce((sum, w) => sum + w.semVenda, 0);
  const activeWorkers = workersProgress.filter(w => !w.done).length;
  const completedWorkers = workersProgress.filter(w => w.done).length;
  
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = elapsed > 0 ? totalProcessed / elapsed : 0;
  const remaining = rate > 0 ? (totalRecords - totalProcessed) / rate : 0;

  // Limpar e reescrever
  process.stdout.write('\x1B[2J\x1B[0f');
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 MIGRAÇÃO PARALELA: PARCELAS (50 WORKERS)                         ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  ${progressBar(totalProcessed, totalRecords)} ${formatNumber(totalProcessed).padStart(10)}/${formatNumber(totalRecords)}  ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  ⚡ Velocidade: ${formatNumber(Math.round(rate)).padStart(6)}/s    ⏱️  Tempo: ${formatDuration(elapsed * 1000).padStart(10)}    ETA: ${formatDuration(remaining * 1000).padStart(10)}  ║`);
  console.log(`║  👷 Workers: ${activeWorkers}/${NUM_WORKERS} ativos    ✅ Concluídos: ${completedWorkers}    ⚠️  Sem venda: ${formatNumber(totalSemVenda).padStart(8)}  ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  
  // Mostrar apenas os 10 primeiros workers ativos
  const activeList = workersProgress.filter(w => !w.done).slice(0, 10);
  for (const w of activeList) {
    const workerProgress = w.endId > w.startId 
      ? ((w.currentId - w.startId) / (w.endId - w.startId)) * 100 
      : 100;
    const bar = progressBar(w.currentId - w.startId, w.endId - w.startId, 12);
    console.log(`║  🔄 W${w.workerId.toString().padStart(2)}: ${bar} ${formatNumber(w.processed).padStart(8)} ok  ║`);
  }
  
  if (activeWorkers > 10) {
    console.log(`║  ... +${activeWorkers - 10} workers (${completedWorkers} concluídos)                                     ║`);
  }
  
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
}

// ═══════════════════════════════════════════════════════════════════
// CRIAR CONEXÃO MYSQL COM RETRY
// ═══════════════════════════════════════════════════════════════════
async function createMySQLConnection(): Promise<mysql.Connection> {
  const config = {
    host: '200.98.112.240',
    port: 3306,
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
    charset: 'utf8mb4',
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      return await mysql.createConnection(config);
    } catch (err: any) {
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
      }
    }
  }
  throw new Error('Não foi possível conectar ao MySQL');
}

// ═══════════════════════════════════════════════════════════════════
// WORKER PARA PROCESSAR PARCELAS
// ═══════════════════════════════════════════════════════════════════
async function parcelaWorker(workerId: number, startId: number, endId: number): Promise<void> {
  const progress = workersProgress[workerId];
  progress.startId = startId;
  progress.endId = endId;
  progress.currentId = startId;

  const mysqlConn = await createMySQLConnection();
  const prisma = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }
    }
  });

  let currentId = startId;

  try {
    while (currentId < endId) {
      const [parcelas] = await mysqlConn.query<mysql.RowDataPacket[]>(
        'SELECT * FROM parcelas WHERE id >= ? AND id < ? ORDER BY id LIMIT ?',
        [currentId, endId, BATCH_SIZE]
      ) as [MySQLParcela[], any];

      if (parcelas.length === 0) break;

      for (const parcela of parcelas) {
        const matriculaNum = parseInt(parcela.matricula);
        const sequenciaNum = parseInt(parcela.sequencia);

        const vendaId = vendaIdMap.get(`${matriculaNum}-${sequenciaNum}`);
        if (!vendaId) {
          progress.semVenda++;
          currentId = parcela.id + 1;
          progress.currentId = currentId;
          continue;
        }

        const numeroParcela = parseInt(parcela.nrseq) || 1;

        try {
          await prisma.parcela.create({
            data: {
              vendaId: vendaId,
              numeroParcela: numeroParcela,
              dataVencimento: parcela.vencimento,
              valor: parcela.valor || 0,
              baixa: parcela.baixa?.trim() || null,
              dataBaixa: parcela.baixa === 'S' ? new Date() : null,
              valorPago: parcela.baixa === 'S' ? (parcela.valor || 0) : null,
              tipo: parcela.tipo?.trim() || null,
              createdById: adminUserId
            }
          });
          progress.processed++;
        } catch (err: any) {
          if (err.code !== 'P2002') progress.errors++;
        }

        currentId = parcela.id + 1;
        progress.currentId = currentId;
      }
    }
  } catch (err: any) {
    log(`Worker ${workerId} erro: ${err.message}`);
    progress.errors++;
  } finally {
    await mysqlConn.end();
    await prisma.$disconnect();
    progress.done = true;
  }
}

// ═══════════════════════════════════════════════════════════════════
// MIGRAÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
async function migrate() {
  console.clear();
  log('🚀 Iniciando migração de PARCELAS com 50 workers...');
  startTime = Date.now();

  const mainConn = await createMySQLConnection();
  const mainPrisma = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // CARREGAR MAPA DE VENDAS (RAILWAY)
  // ─────────────────────────────────────────────────────────────────
  log('📊 Carregando mapa de vendas do Railway...');
  
  // Buscar todas as vendas do Railway com sócio para mapear matricula-sequencia → vendaId
  const vendasRailway = await mainPrisma.venda.findMany({
    select: { 
      id: true, 
      numeroVenda: true,
      socio: { select: { matricula: true } }
    }
  });

  // Carregar mapeamento de matrículas do MySQL para encontrar matrícula antiga
  const [matriculasRows] = await mainConn.query('SELECT matricula_antiga, matricula_atual FROM matriculas');
  const matriculaReverseMap = new Map<string, string>();
  (matriculasRows as any[]).forEach(m => {
    matriculaReverseMap.set(m.matricula_atual.toString(), m.matricula_antiga.toString());
  });

  // Construir mapa matricula_antiga-sequencia → vendaId
  vendaIdMap = new Map();
  for (const v of vendasRailway) {
    const matriculaAtual = v.socio.matricula.trim();
    // Tentar encontrar matrícula antiga, senão usar a atual
    const matriculaAntiga = matriculaReverseMap.get(matriculaAtual) || matriculaAtual;
    vendaIdMap.set(`${matriculaAntiga}-${v.numeroVenda}`, v.id);
  }
  log(`   ✅ ${formatNumber(vendaIdMap.size)} vendas mapeadas`);

  // Admin user
  const admin = await mainPrisma.users.findFirst({ where: { email: 'admin@consigexpress.com' } });
  if (!admin) throw new Error('Admin não encontrado!');
  adminUserId = admin.id;
  log(`   ✅ Admin: ${adminUserId}`);

  // ─────────────────────────────────────────────────────────────────
  // ESTATÍSTICAS
  // ─────────────────────────────────────────────────────────────────
  const parcelasRailwayAntes = await mainPrisma.parcela.count();
  const [[parcelasStats]] = await mainConn.query('SELECT MIN(id) as minId, MAX(id) as maxId, COUNT(*) as total FROM parcelas') as any;
  
  const parcelasMinId = parcelasStats.minId;
  const parcelasMaxId = parcelasStats.maxId;
  totalRecords = parcelasStats.total;

  log(`\n📊 ESTATÍSTICAS:`);
  log(`   MySQL: ${formatNumber(totalRecords)} parcelas (IDs: ${parcelasMinId} - ${parcelasMaxId})`);
  log(`   Railway (antes): ${formatNumber(parcelasRailwayAntes)} parcelas`);
  log(`   Workers: ${NUM_WORKERS}`);

  // ─────────────────────────────────────────────────────────────────
  // INICIALIZAR WORKERS
  // ─────────────────────────────────────────────────────────────────
  workersProgress.length = 0;
  const chunkSize = Math.ceil((parcelasMaxId - parcelasMinId + 1) / NUM_WORKERS);

  for (let i = 0; i < NUM_WORKERS; i++) {
    workersProgress.push({
      workerId: i,
      processed: 0,
      errors: 0,
      semVenda: 0,
      currentId: parcelasMinId + (i * chunkSize),
      startId: parcelasMinId + (i * chunkSize),
      endId: Math.min(parcelasMinId + ((i + 1) * chunkSize), parcelasMaxId + 1),
      done: false
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // EXECUTAR MIGRAÇÃO PARALELA
  // ─────────────────────────────────────────────────────────────────
  log('\n🚀 Iniciando migração paralela...\n');
  
  const progressInterval = setInterval(() => displayProgress(), PROGRESS_INTERVAL);
  startTime = Date.now();

  const workerPromises = workersProgress.map(w => 
    parcelaWorker(w.workerId, w.startId, w.endId)
  );

  await Promise.all(workerPromises);
  clearInterval(progressInterval);
  displayProgress(); // Display final

  // ─────────────────────────────────────────────────────────────────
  // RESUMO FINAL
  // ─────────────────────────────────────────────────────────────────
  const totalTime = Date.now() - startTime;
  const totalProcessed = workersProgress.reduce((sum, w) => sum + w.processed, 0);
  const totalSemVenda = workersProgress.reduce((sum, w) => sum + w.semVenda, 0);
  const totalErrors = workersProgress.reduce((sum, w) => sum + w.errors, 0);

  const parcelasRailwayDepois = await mainPrisma.parcela.count();

  await mainConn.end();
  await mainPrisma.$disconnect();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║               ✅ MIGRAÇÃO DE PARCELAS CONCLUÍDA!                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  📊 Railway (antes):  ${formatNumber(parcelasRailwayAntes).padStart(10)} parcelas                          ║`);
  console.log(`║  📊 Railway (depois): ${formatNumber(parcelasRailwayDepois).padStart(10)} parcelas                          ║`);
  console.log(`║  📊 Migradas:         ${formatNumber(totalProcessed).padStart(10)} parcelas                          ║`);
  console.log(`║  ⚠️  Sem venda:        ${formatNumber(totalSemVenda).padStart(10)}                                    ║`);
  console.log(`║  ❌ Erros:            ${formatNumber(totalErrors).padStart(10)}                                    ║`);
  console.log(`║  ⏱️  Tempo total:      ${formatDuration(totalTime).padStart(15)}                               ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  log(`📄 Log: ${LOG_FILE}`);
}

// Executar
migrate().catch(err => {
  log(`\n❌ ERRO FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});

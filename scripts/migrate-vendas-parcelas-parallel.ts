import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════
const NUM_WORKERS_VENDAS = 20;   // Workers para vendas (menos registros)
const NUM_WORKERS_PARCELAS = 50; // Workers para parcelas (mais registros)
const BATCH_SIZE = 200;          // Registros por batch em cada worker
const PROGRESS_INTERVAL = 500;   // Atualizar progresso a cada 0.5s

const CHECKPOINT_FILE = path.join(__dirname, 'migration-parallel-checkpoint.json');
const LOG_FILE = path.join(__dirname, 'migration-parallel-log.txt');

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface WorkerProgress {
  workerId: number;
  processed: number;
  errors: number;
  semSocio: number;
  currentId: number;
  startId: number;
  endId: number;
  done: boolean;
}

interface GlobalProgress {
  phase: 'vendas' | 'parcelas' | 'completed';
  workers: WorkerProgress[];
  startedAt: string;
}

interface MySQLVenda {
  id: number;
  matricula: number;
  sequencia: number;
  emissao: Date;
  associado: string;
  codconven: number | null;
  conveniado: string | null;
  parcelas: number;
  autorizado: string | null;
  operador: string | null;
  valorparcela: number;
  cancela: string | null;
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

// Dados de referência (compartilhados entre workers)
let matriculaMap: Map<number, number>;
let socioByMatricula: Map<string, string>;
let convenioByCodigo: Map<number, number>;
let adminUserId: string;
let vendaIdMap: Map<string, string>;

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

function progressBar(current: number, total: number, width: number = 25): string {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.round((width * current) / total);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toFixed(1)}%`;
}

// ═══════════════════════════════════════════════════════════════════
// DISPLAY DE PROGRESSO EM TEMPO REAL
// ═══════════════════════════════════════════════════════════════════
function displayProgress(phase: string) {
  const totalProcessed = workersProgress.reduce((sum, w) => sum + w.processed, 0);
  const totalErrors = workersProgress.reduce((sum, w) => sum + w.errors, 0);
  const totalSemSocio = workersProgress.reduce((sum, w) => sum + w.semSocio, 0);
  const activeWorkers = workersProgress.filter(w => !w.done).length;
  
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = totalProcessed / elapsed;
  const remaining = (totalRecords - totalProcessed) / rate;

  // Limpar e reescrever
  process.stdout.write('\x1B[2J\x1B[0f'); // Limpar tela
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log(`║  🚀 MIGRAÇÃO PARALELA: ${phase.toUpperCase().padEnd(45)}║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  ${progressBar(totalProcessed, totalRecords, 40)} ${formatNumber(totalProcessed).padStart(10)}/${formatNumber(totalRecords)}  ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  ⚡ Velocidade: ${formatNumber(Math.round(rate)).padStart(6)}/s    ⏱️  Tempo: ${formatDuration(elapsed * 1000).padStart(10)}    ETA: ${formatDuration(remaining * 1000).padStart(10)}  ║`);
  console.log(`║  👷 Workers ativos: ${String(activeWorkers).padStart(2)}/${String(workersProgress.length).padStart(2)}       ❌ Erros: ${formatNumber(totalErrors).padStart(6)}    ⚠️  Sem sócio: ${formatNumber(totalSemSocio).padStart(6)}  ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  
  // Status de cada worker (compacto para muitos workers)
  const SHOW_WORKERS = 10; // Mostrar apenas os primeiros N workers
  const workersToShow = workersProgress.slice(0, SHOW_WORKERS);
  for (const w of workersToShow) {
    const workerProgress = w.endId > w.startId 
      ? ((w.currentId - w.startId) / (w.endId - w.startId)) * 100 
      : 100;
    const status = w.done ? '✅' : '🔄';
    const bar = progressBar(w.currentId - w.startId, w.endId - w.startId, 12);
    console.log(`║  ${status} W${String(w.workerId).padStart(2)}: ${bar} ${formatNumber(w.processed).padStart(7)} ok  ║`);
  }
  if (workersProgress.length > SHOW_WORKERS) {
    const restDone = workersProgress.slice(SHOW_WORKERS).filter(w => w.done).length;
    const restTotal = workersProgress.length - SHOW_WORKERS;
    console.log(`║  ... +${restTotal} workers (${restDone} concluídos)                                     ║`);
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
// WORKER PARA PROCESSAR VENDAS
// ═══════════════════════════════════════════════════════════════════
async function vendaWorker(workerId: number, startId: number, endId: number): Promise<void> {
  const progress = workersProgress[workerId];
  progress.startId = startId;
  progress.endId = endId;
  progress.currentId = startId;

  // Cada worker tem sua própria conexão
  const mysqlConn = await createMySQLConnection();
  const prisma = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }
    }
  });

  let currentId = startId;

  try {
    while (currentId < endId) {
      const [vendas] = await mysqlConn.query<mysql.RowDataPacket[]>(
        'SELECT * FROM vendas WHERE id >= ? AND id < ? ORDER BY id LIMIT ?',
        [currentId, endId, BATCH_SIZE]
      ) as [MySQLVenda[], any];

      if (vendas.length === 0) break;

      for (const venda of vendas) {
        // Aplicar mapeamento de matrícula
        let matriculaAtual = venda.matricula;
        if (matriculaMap.has(venda.matricula)) {
          matriculaAtual = matriculaMap.get(venda.matricula)!;
        }

        const socioId = socioByMatricula.get(matriculaAtual.toString());
        if (!socioId) {
          progress.semSocio++;
          currentId = venda.id + 1;
          progress.currentId = currentId;
          continue;
        }

        const convenioId = venda.codconven ? convenioByCodigo.get(venda.codconven) : null;

        try {
          const novaVenda = await prisma.venda.create({
            data: {
              userId: adminUserId,
              socioId: socioId,
              convenioId: convenioId ?? null,
              numeroVenda: venda.sequencia,
              dataEmissao: venda.emissao,
              operador: venda.operador?.trim() || null,
              quantidadeParcelas: Math.round(venda.parcelas || 1),
              valorParcela: venda.valorparcela || 0,
              valorTotal: (venda.valorparcela || 0) * (venda.parcelas || 1),
              ativo: venda.cancela !== 'S',
              cancelado: venda.cancela === 'S',
              motivoCancelamento: venda.cancela === 'S' ? 'Cancelado no sistema antigo' : null,
              createdById: adminUserId
            }
          });

          // Salvar no mapa global (thread-safe no Node single-thread)
          vendaIdMap.set(`${venda.matricula}-${venda.sequencia}`, novaVenda.id);
          progress.processed++;
        } catch (err: any) {
          if (err.code !== 'P2002') progress.errors++;
        }

        currentId = venda.id + 1;
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
// WORKER PARA PROCESSAR PARCELAS
// ═══════════════════════════════════════════════════════════════════
async function parcelaWorker(workerId: number, startId: number, endId: number): Promise<void> {
  const progress = workersProgress[workerId];
  progress.startId = startId;
  progress.endId = endId;
  progress.currentId = startId;
  progress.processed = 0;
  progress.errors = 0;
  progress.semSocio = 0;
  progress.done = false;

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
          progress.semSocio++; // Reusando campo para "sem venda"
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
  log('🚀 Iniciando migração paralela...');
  startTime = Date.now();

  // Conexão principal para dados de referência
  const mainConn = await createMySQLConnection();
  const mainPrisma = new PrismaClient({
    datasources: {
      db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // CARREGAR DADOS DE REFERÊNCIA
  // ─────────────────────────────────────────────────────────────────
  log('📊 Carregando dados de referência...');

  // Mapeamento de matrículas
  const [matriculasRows] = await mainConn.query('SELECT * FROM matriculas');
  matriculaMap = new Map();
  (matriculasRows as any[]).forEach(m => matriculaMap.set(m.matricula_antiga, m.matricula_atual));
  log(`   ✅ ${formatNumber(matriculaMap.size)} mapeamentos de matrícula`);

  // Sócios
  const socios = await mainPrisma.socio.findMany({ select: { id: true, matricula: true } });
  socioByMatricula = new Map();
  socios.forEach(s => socioByMatricula.set(s.matricula.trim(), s.id));
  log(`   ✅ ${formatNumber(socioByMatricula.size)} sócios`);

  // Convênios (codigo em convenio = codconven em vendas MySQL)
  const convenios = await mainPrisma.convenio.findMany({ select: { id: true, codigo: true } });
  convenioByCodigo = new Map();
  convenios.forEach(c => { 
    if (c.codigo !== null && c.codigo !== undefined) {
      const codigoNum = parseInt(c.codigo);
      if (!isNaN(codigoNum)) convenioByCodigo.set(codigoNum, c.id);
    }
  });
  log(`   ✅ ${formatNumber(convenioByCodigo.size)} convênios`);

  // Admin
  const admin = await mainPrisma.users.findFirst({ where: { email: 'admin@consigexpress.com' } });
  if (!admin) throw new Error('Admin não encontrado!');
  adminUserId = admin.id;
  log(`   ✅ Admin: ${adminUserId}`);

  // Mapa de vendas
  vendaIdMap = new Map();

  // ─────────────────────────────────────────────────────────────────
  // FASE 1: MIGRAR VENDAS EM PARALELO
  // ─────────────────────────────────────────────────────────────────
  log('\n📊 FASE 1: Migrando VENDAS em paralelo...');

  // Contar e obter range de IDs
  const [[vendasStats]] = await mainConn.query('SELECT MIN(id) as minId, MAX(id) as maxId, COUNT(*) as total FROM vendas') as any;
  const vendasMinId = vendasStats.minId;
  const vendasMaxId = vendasStats.maxId;
  totalRecords = vendasStats.total;
  
  log(`   Total: ${formatNumber(totalRecords)} vendas (IDs: ${vendasMinId} - ${vendasMaxId})`);

  // Inicializar workers progress
  workersProgress.length = 0;
  const vendasChunkSize = Math.ceil((vendasMaxId - vendasMinId + 1) / NUM_WORKERS_VENDAS);
  
  for (let i = 0; i < NUM_WORKERS_VENDAS; i++) {
    workersProgress.push({
      workerId: i,
      processed: 0,
      errors: 0,
      semSocio: 0,
      currentId: vendasMinId + (i * vendasChunkSize),
      startId: vendasMinId + (i * vendasChunkSize),
      endId: Math.min(vendasMinId + ((i + 1) * vendasChunkSize), vendasMaxId + 1),
      done: false
    });
  }

  // Iniciar display de progresso
  const progressInterval = setInterval(() => displayProgress('VENDAS'), PROGRESS_INTERVAL);

  // Executar workers em paralelo
  startTime = Date.now();
  const vendaPromises = workersProgress.map(w => 
    vendaWorker(w.workerId, w.startId, w.endId)
  );

  await Promise.all(vendaPromises);
  clearInterval(progressInterval);
  displayProgress('VENDAS'); // Display final

  const vendasMigradas = workersProgress.reduce((sum, w) => sum + w.processed, 0);
  const vendasSemSocio = workersProgress.reduce((sum, w) => sum + w.semSocio, 0);
  log(`\n   ✅ Vendas migradas: ${formatNumber(vendasMigradas)}`);
  log(`   ⚠️  Vendas sem sócio: ${formatNumber(vendasSemSocio)}`);
  log(`   📦 Mapa de vendas: ${formatNumber(vendaIdMap.size)} entradas`);

  // Salvar mapa de vendas
  const vendaMapFile = path.join(__dirname, 'venda-id-map-parallel.json');
  const vendaMapObj: Record<string, string> = {};
  vendaIdMap.forEach((v, k) => vendaMapObj[k] = v);
  fs.writeFileSync(vendaMapFile, JSON.stringify(vendaMapObj));

  // ─────────────────────────────────────────────────────────────────
  // FASE 2: MIGRAR PARCELAS EM PARALELO
  // ─────────────────────────────────────────────────────────────────
  log('\n📊 FASE 2: Migrando PARCELAS em paralelo...');

  const [[parcelasStats]] = await mainConn.query('SELECT MIN(id) as minId, MAX(id) as maxId, COUNT(*) as total FROM parcelas') as any;
  const parcelasMinId = parcelasStats.minId;
  const parcelasMaxId = parcelasStats.maxId;
  totalRecords = parcelasStats.total;

  log(`   Total: ${formatNumber(totalRecords)} parcelas (IDs: ${parcelasMinId} - ${parcelasMaxId})`);

  // Reinicializar workers
  workersProgress.length = 0;
  const parcelasChunkSize = Math.ceil((parcelasMaxId - parcelasMinId + 1) / NUM_WORKERS_PARCELAS);

  for (let i = 0; i < NUM_WORKERS_PARCELAS; i++) {
    workersProgress.push({
      workerId: i,
      processed: 0,
      errors: 0,
      semSocio: 0,
      currentId: parcelasMinId + (i * parcelasChunkSize),
      startId: parcelasMinId + (i * parcelasChunkSize),
      endId: Math.min(parcelasMinId + ((i + 1) * parcelasChunkSize), parcelasMaxId + 1),
      done: false
    });
  }

  // Iniciar display de progresso
  const progressInterval2 = setInterval(() => displayProgress('PARCELAS'), PROGRESS_INTERVAL);

  // Executar workers em paralelo
  startTime = Date.now();
  const parcelaPromises = workersProgress.map(w => 
    parcelaWorker(w.workerId, w.startId, w.endId)
  );

  await Promise.all(parcelaPromises);
  clearInterval(progressInterval2);
  displayProgress('PARCELAS'); // Display final

  const parcelasMigradas = workersProgress.reduce((sum, w) => sum + w.processed, 0);
  const parcelasSemVenda = workersProgress.reduce((sum, w) => sum + w.semSocio, 0);
  log(`\n   ✅ Parcelas migradas: ${formatNumber(parcelasMigradas)}`);
  log(`   ⚠️  Parcelas sem venda: ${formatNumber(parcelasSemVenda)}`);

  // ─────────────────────────────────────────────────────────────────
  // VERIFICAÇÃO FINAL
  // ─────────────────────────────────────────────────────────────────
  log('\n' + '═'.repeat(70));
  log('📊 VERIFICAÇÃO FINAL');
  
  const vendasFinal = await mainPrisma.venda.count();
  const parcelasFinal = await mainPrisma.parcela.count();

  log(`   Railway: ${formatNumber(vendasFinal)} vendas | ${formatNumber(parcelasFinal)} parcelas`);

  // Cleanup
  await mainConn.end();
  await mainPrisma.$disconnect();

  // Limpar arquivos temporários
  if (fs.existsSync(vendaMapFile)) fs.unlinkSync(vendaMapFile);

  const totalTime = Date.now() - startTime;
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║               ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  📊 Vendas:   ${formatNumber(vendasMigradas).padStart(10)} migradas | ${formatNumber(vendasSemSocio).padStart(8)} sem sócio       ║`);
  console.log(`║  📊 Parcelas: ${formatNumber(parcelasMigradas).padStart(10)} migradas | ${formatNumber(parcelasSemVenda).padStart(8)} sem venda      ║`);
  console.log(`║  ⏱️  Tempo total: ${formatDuration(totalTime).padStart(15)}                                  ║`);
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

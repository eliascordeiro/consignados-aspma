import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════
const BATCH_SIZE = 100; // Menor para mostrar progresso mais frequente
const CHECKPOINT_FILE = path.join(__dirname, 'migration-checkpoint.json');
const LOG_FILE = path.join(__dirname, 'migration-log.txt');

// Railway PostgreSQL
const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface Checkpoint {
  phase: 'vendas' | 'parcelas' | 'completed';
  lastVendaId: number;
  lastParcelaId: number;
  vendasMigradas: number;
  parcelasMigradas: number;
  vendasSemSocio: number;
  parcelasSemVenda: number;
  startedAt: string;
  lastUpdatedAt: string;
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
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('pt-BR');
}

function progressBar(current: number, total: number, width: number = 30): string {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.round((width * current) / total);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toFixed(1)}%`;
}

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    log('⚠️  Erro ao carregar checkpoint, iniciando do zero');
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint) {
  checkpoint.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function clearCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONEXÃO MYSQL COM RECONEXÃO AUTOMÁTICA
// ═══════════════════════════════════════════════════════════════════
class MySQLConnection {
  private connection: mysql.Connection | null = null;
  private config = {
    host: '200.98.112.240',
    port: 3306,
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
    charset: 'utf8mb4',
    connectTimeout: 60000,
    // Configurações para manter conexão viva
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };

  async connect(): Promise<mysql.Connection> {
    if (this.connection) {
      try {
        await this.connection.ping();
        return this.connection;
      } catch {
        log('🔄 Conexão MySQL perdida, reconectando...');
        this.connection = null;
      }
    }

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        this.connection = await mysql.createConnection(this.config);
        log('✅ MySQL conectado');
        return this.connection;
      } catch (err: any) {
        attempts++;
        log(`❌ Tentativa ${attempts}/${maxAttempts} falhou: ${err.message}`);
        if (attempts < maxAttempts) {
          const waitTime = Math.min(5000 * attempts, 30000);
          log(`   Aguardando ${waitTime / 1000}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error('Não foi possível conectar ao MySQL após várias tentativas');
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const conn = await this.connect();
    try {
      const [rows] = await conn.query(sql, params);
      return rows as T[];
    } catch (err: any) {
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        log('🔄 Conexão perdida durante query, reconectando...');
        this.connection = null;
        const conn = await this.connect();
        const [rows] = await conn.query(sql, params);
        return rows as T[];
      }
      throw err;
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// MIGRAÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
async function migrate() {
  console.clear();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     MIGRAÇÃO ROBUSTA: VENDAS E PARCELAS (MySQL → Railway)        ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  • Reconexão automática ao MySQL                                 ║');
  console.log('║  • Checkpoint para retomar de onde parou                         ║');
  console.log('║  • Log detalhado em arquivo                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();
  const mysqlConn = new MySQLConnection();

  // Carregar ou criar checkpoint
  let checkpoint = loadCheckpoint();
  if (checkpoint && checkpoint.phase !== 'completed') {
    log(`📋 Retomando migração do checkpoint:`);
    log(`   • Fase: ${checkpoint.phase}`);
    log(`   • Última venda ID: ${checkpoint.lastVendaId}`);
    log(`   • Última parcela ID: ${checkpoint.lastParcelaId}`);
    log(`   • Vendas migradas: ${formatNumber(checkpoint.vendasMigradas)}`);
    log(`   • Parcelas migradas: ${formatNumber(checkpoint.parcelasMigradas)}`);
  } else {
    checkpoint = {
      phase: 'vendas',
      lastVendaId: 0,
      lastParcelaId: 0,
      vendasMigradas: 0,
      parcelasMigradas: 0,
      vendasSemSocio: 0,
      parcelasSemVenda: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    };
    log('🆕 Iniciando nova migração');
  }

  // ─────────────────────────────────────────────────────────────────
  // PASSO 1: Carregar dados de referência
  // ─────────────────────────────────────────────────────────────────
  log('\n' + '═'.repeat(70));
  log('📊 PASSO 1: Carregando dados de referência...');
  log('═'.repeat(70));

  // Mapeamento de matrículas
  log('   → Carregando mapeamento de matrículas do MySQL...');
  const matriculasRows = await mysqlConn.query<{ matricula_antiga: number; matricula_atual: number }>(
    'SELECT matricula_antiga, matricula_atual FROM matriculas'
  );
  const matriculaMap = new Map<number, number>();
  matriculasRows.forEach(m => matriculaMap.set(m.matricula_antiga, m.matricula_atual));
  log(`   ✅ ${formatNumber(matriculaMap.size)} mapeamentos de matrícula carregados`);

  // Sócios do Railway
  log('   → Carregando sócios do Railway...');
  const sociosRailway = await railwayPrisma.socio.findMany({
    select: { id: true, matricula: true }
  });
  const socioByMatricula = new Map<string, string>();
  sociosRailway.forEach(s => socioByMatricula.set(s.matricula.trim(), s.id));
  log(`   ✅ ${formatNumber(socioByMatricula.size)} sócios mapeados`);

  // Convênios do Railway
  log('   → Carregando convênios do Railway...');
  const conveniosRailway = await railwayPrisma.convenio.findMany({
    select: { id: true, codconven: true }
  });
  const convenioByCodigo = new Map<number, number>();
  conveniosRailway.forEach(c => {
    if (c.codconven !== null) convenioByCodigo.set(c.codconven, c.id);
  });
  log(`   ✅ ${formatNumber(convenioByCodigo.size)} convênios mapeados`);

  // Usuário admin
  log('   → Buscando usuário admin...');
  const adminUser = await railwayPrisma.users.findFirst({
    where: { email: 'admin@consigexpress.com' },
    select: { id: true }
  });
  if (!adminUser) throw new Error('Usuário admin não encontrado!');
  log(`   ✅ Admin: ${adminUser.id}`);

  // Contagens totais
  const [{ total: totalVendas }] = await mysqlConn.query<{ total: number }>('SELECT COUNT(*) as total FROM vendas');
  const [{ total: totalParcelas }] = await mysqlConn.query<{ total: number }>('SELECT COUNT(*) as total FROM parcelas');
  log(`\n   📈 Total no MySQL: ${formatNumber(totalVendas)} vendas | ${formatNumber(totalParcelas)} parcelas`);

  // ─────────────────────────────────────────────────────────────────
  // PASSO 2: Migrar Vendas
  // ─────────────────────────────────────────────────────────────────
  if (checkpoint.phase === 'vendas') {
    log('\n' + '═'.repeat(70));
    log('📊 PASSO 2: Migrando VENDAS...');
    log('═'.repeat(70));

    // Mapa para relacionar vendas (matricula-sequencia) → vendaId Railway
    const vendaIdMap = new Map<string, string>();
    
    // Se retomando, carregar vendas já migradas
    if (checkpoint.lastVendaId > 0) {
      log('   → Carregando vendas já migradas do Railway...');
      const vendasExistentes = await railwayPrisma.venda.findMany({
        select: { id: true, socioId: true, numeroVenda: true }
      });
      
      // Precisamos reconstruir o mapa - buscar sócio para pegar matrícula
      for (const v of vendasExistentes) {
        const socio = await railwayPrisma.socio.findUnique({
          where: { id: v.socioId },
          select: { matricula: true }
        });
        if (socio) {
          // Precisamos da matrícula ANTIGA para o mapa
          const matriculaAtual = socio.matricula.trim();
          // Encontrar matrícula antiga se existir no mapeamento inverso
          let matriculaAntiga = matriculaAtual;
          for (const [antiga, atual] of matriculaMap.entries()) {
            if (atual.toString() === matriculaAtual) {
              matriculaAntiga = antiga.toString();
              break;
            }
          }
          vendaIdMap.set(`${matriculaAntiga}-${v.numeroVenda}`, v.id);
        }
      }
      log(`   ✅ ${formatNumber(vendaIdMap.size)} vendas já existentes mapeadas`);
    }

    let offset = checkpoint.lastVendaId;
    let hasMore = true;

    while (hasMore) {
      // Buscar batch de vendas
      const vendas = await mysqlConn.query<MySQLVenda>(
        'SELECT * FROM vendas WHERE id > ? ORDER BY id LIMIT ?',
        [offset, BATCH_SIZE]
      );

      if (vendas.length === 0) {
        hasMore = false;
        break;
      }

      for (const venda of vendas) {
        // Aplicar mapeamento de matrícula
        let matriculaAtual = venda.matricula;
        const matriculaAtualizada = matriculaMap.has(venda.matricula);
        if (matriculaAtualizada) {
          matriculaAtual = matriculaMap.get(venda.matricula)!;
        }

        // Encontrar sócio
        const socioId = socioByMatricula.get(matriculaAtual.toString());
        if (!socioId) {
          checkpoint.vendasSemSocio++;
          offset = venda.id;
          continue;
        }

        // Encontrar convênio
        const convenioId = venda.codconven ? convenioByCodigo.get(venda.codconven) : null;

        try {
          const novaVenda = await railwayPrisma.venda.create({
            data: {
              userId: adminUser.id,
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
              createdById: adminUser.id
            }
          });

          vendaIdMap.set(`${venda.matricula}-${venda.sequencia}`, novaVenda.id);
          checkpoint.vendasMigradas++;
        } catch (err: any) {
          if (err.code !== 'P2002') { // Ignorar duplicados silenciosamente
            // Log apenas erros não-duplicados importantes
          }
        }

        offset = venda.id;
      }

      // Atualizar checkpoint
      checkpoint.lastVendaId = offset;
      saveCheckpoint(checkpoint);

      // Mostrar progresso
      const elapsed = Date.now() - startTime;
      const progress = (checkpoint.vendasMigradas / totalVendas) * 100;
      const rate = checkpoint.vendasMigradas / (elapsed / 1000);
      const remaining = (totalVendas - checkpoint.vendasMigradas) / rate;

      process.stdout.write('\r');
      process.stdout.write(
        `   ${progressBar(checkpoint.vendasMigradas, totalVendas)} ` +
        `${formatNumber(checkpoint.vendasMigradas)}/${formatNumber(totalVendas)} | ` +
        `${rate.toFixed(0)}/s | ` +
        `ETA: ${formatDuration(remaining * 1000)}   `
      );
    }

    console.log(''); // Nova linha após progresso
    log(`\n   ✅ VENDAS CONCLUÍDAS:`);
    log(`      • Migradas: ${formatNumber(checkpoint.vendasMigradas)}`);
    log(`      • Sem sócio: ${formatNumber(checkpoint.vendasSemSocio)}`);

    // Salvar mapa de vendas para parcelas
    const vendaMapFile = path.join(__dirname, 'venda-id-map.json');
    const vendaMapObj: Record<string, string> = {};
    vendaIdMap.forEach((v, k) => vendaMapObj[k] = v);
    fs.writeFileSync(vendaMapFile, JSON.stringify(vendaMapObj));
    log(`      • Mapa de vendas salvo: ${vendaIdMap.size} entradas`);

    checkpoint.phase = 'parcelas';
    checkpoint.lastParcelaId = 0;
    saveCheckpoint(checkpoint);
  }

  // ─────────────────────────────────────────────────────────────────
  // PASSO 3: Migrar Parcelas
  // ─────────────────────────────────────────────────────────────────
  if (checkpoint.phase === 'parcelas') {
    log('\n' + '═'.repeat(70));
    log('📊 PASSO 3: Migrando PARCELAS...');
    log('═'.repeat(70));

    // Carregar mapa de vendas
    const vendaMapFile = path.join(__dirname, 'venda-id-map.json');
    let vendaIdMap = new Map<string, string>();
    
    if (fs.existsSync(vendaMapFile)) {
      const vendaMapObj = JSON.parse(fs.readFileSync(vendaMapFile, 'utf-8'));
      vendaIdMap = new Map(Object.entries(vendaMapObj));
      log(`   ✅ Mapa de vendas carregado: ${formatNumber(vendaIdMap.size)} entradas`);
    } else {
      // Reconstruir mapa buscando do Railway
      log('   → Reconstruindo mapa de vendas do Railway...');
      const vendasRailway = await railwayPrisma.venda.findMany({
        select: { id: true, socioId: true, numeroVenda: true }
      });
      
      for (const v of vendasRailway) {
        const socio = await railwayPrisma.socio.findUnique({
          where: { id: v.socioId },
          select: { matricula: true }
        });
        if (socio) {
          const matriculaAtual = socio.matricula.trim();
          // Encontrar matrícula antiga
          let matriculaAntiga = matriculaAtual;
          for (const [antiga, atual] of matriculaMap.entries()) {
            if (atual.toString() === matriculaAtual) {
              matriculaAntiga = antiga.toString();
              break;
            }
          }
          vendaIdMap.set(`${matriculaAntiga}-${v.numeroVenda}`, v.id);
        }
      }
      log(`   ✅ Mapa reconstruído: ${formatNumber(vendaIdMap.size)} vendas`);
    }

    let offset = checkpoint.lastParcelaId;
    let hasMore = true;
    const parcelasStartTime = Date.now();

    while (hasMore) {
      // Buscar batch de parcelas
      const parcelas = await mysqlConn.query<MySQLParcela>(
        'SELECT * FROM parcelas WHERE id > ? ORDER BY id LIMIT ?',
        [offset, BATCH_SIZE]
      );

      if (parcelas.length === 0) {
        hasMore = false;
        break;
      }

      for (const parcela of parcelas) {
        const matriculaNum = parseInt(parcela.matricula);
        const sequenciaNum = parseInt(parcela.sequencia);

        // Encontrar vendaId
        const vendaId = vendaIdMap.get(`${matriculaNum}-${sequenciaNum}`);
        if (!vendaId) {
          checkpoint.parcelasSemVenda++;
          offset = parcela.id;
          continue;
        }

        const numeroParcela = parseInt(parcela.nrseq) || 1;

        try {
          await railwayPrisma.parcela.create({
            data: {
              vendaId: vendaId,
              numeroParcela: numeroParcela,
              dataVencimento: parcela.vencimento,
              valor: parcela.valor || 0,
              baixa: parcela.baixa?.trim() || null,
              dataBaixa: parcela.baixa === 'S' ? new Date() : null,
              valorPago: parcela.baixa === 'S' ? (parcela.valor || 0) : null,
              tipo: parcela.tipo?.trim() || null,
              createdById: adminUser.id
            }
          });

          checkpoint.parcelasMigradas++;
        } catch (err: any) {
          // Ignorar duplicados
        }

        offset = parcela.id;
      }

      // Atualizar checkpoint
      checkpoint.lastParcelaId = offset;
      saveCheckpoint(checkpoint);

      // Mostrar progresso
      const elapsed = Date.now() - parcelasStartTime;
      const rate = checkpoint.parcelasMigradas / (elapsed / 1000);
      const remaining = (totalParcelas - checkpoint.parcelasMigradas) / rate;

      process.stdout.write('\r');
      process.stdout.write(
        `   ${progressBar(checkpoint.parcelasMigradas, totalParcelas)} ` +
        `${formatNumber(checkpoint.parcelasMigradas)}/${formatNumber(totalParcelas)} | ` +
        `${rate.toFixed(0)}/s | ` +
        `ETA: ${formatDuration(remaining * 1000)}   `
      );
    }

    console.log(''); // Nova linha após progresso
    log(`\n   ✅ PARCELAS CONCLUÍDAS:`);
    log(`      • Migradas: ${formatNumber(checkpoint.parcelasMigradas)}`);
    log(`      • Sem venda: ${formatNumber(checkpoint.parcelasSemVenda)}`);

    checkpoint.phase = 'completed';
    saveCheckpoint(checkpoint);
  }

  // ─────────────────────────────────────────────────────────────────
  // RESUMO FINAL
  // ─────────────────────────────────────────────────────────────────
  const totalTime = Date.now() - startTime;

  log('\n' + '═'.repeat(70));
  log('📊 VERIFICAÇÃO FINAL');
  log('═'.repeat(70));

  const vendasFinal = await railwayPrisma.venda.count();
  const parcelasFinal = await railwayPrisma.parcela.count();

  log(`\n   RAILWAY:`);
  log(`   • Vendas:   ${formatNumber(vendasFinal)}`);
  log(`   • Parcelas: ${formatNumber(parcelasFinal)}`);

  log(`\n   MIGRAÇÃO:`);
  log(`   • Vendas migradas:    ${formatNumber(checkpoint.vendasMigradas)}`);
  log(`   • Vendas sem sócio:   ${formatNumber(checkpoint.vendasSemSocio)}`);
  log(`   • Parcelas migradas:  ${formatNumber(checkpoint.parcelasMigradas)}`);
  log(`   • Parcelas sem venda: ${formatNumber(checkpoint.parcelasSemVenda)}`);
  log(`   • Tempo total:        ${formatDuration(totalTime)}`);

  // Limpar checkpoint e arquivos temporários
  clearCheckpoint();
  const vendaMapFile = path.join(__dirname, 'venda-id-map.json');
  if (fs.existsSync(vendaMapFile)) {
    fs.unlinkSync(vendaMapFile);
  }

  await mysqlConn.close();
  await railwayPrisma.$disconnect();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`   📄 Log completo: ${LOG_FILE}`);
  console.log('');
}

// Executar
migrate().catch(err => {
  log(`\n❌ ERRO FATAL: ${err.message}`);
  log('   A migração pode ser retomada executando o script novamente.');
  process.exit(1);
});

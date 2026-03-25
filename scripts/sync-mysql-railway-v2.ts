/**
 * SINCRONIZAÇÃO INTELIGENTE: MySQL → Railway
 * 
 * Características:
 * - Verifica registros no Railway e atualiza se existe no MySQL
 * - Usa Promise.all para processamento paralelo
 * - Considera diferenças de schema entre MySQL e Railway
 * - Frequência recomendada: a cada 5 minutos
 * 
 * Mapeamento de campos:
 * 
 * SOCIOS:
 *   MySQL.associado     → Railway.nome
 *   MySQL.matricula     → Railway.matricula
 *   MySQL.nascimento    → Railway.dataNascimento
 *   MySQL.funcao        → Railway.funcao
 *   MySQL.lotacao       → Railway.lotacao
 *   MySQL.fone          → Railway.telefone
 *   MySQL.celular       → Railway.celular
 *   MySQL.email         → Railway.email
 *   MySQL.bloqueio      → Railway.bloqueio ('S'/'N')
 * 
 * VENDAS:
 *   MySQL.sequencia     → Railway.numeroVenda
 *   MySQL.emissao       → Railway.dataEmissao
 *   MySQL.parcelas      → Railway.quantidadeParcelas
 *   MySQL.valorparcela  → Railway.valorParcela
 *   MySQL.cancela       → Railway.cancelado (se != null)
 * 
 * PARCELAS:
 *   MySQL.nrseq         → Railway.numeroParcela
 *   MySQL.vencimento    → Railway.dataVencimento
 *   MySQL.valor         → Railway.valor
 *   MySQL.baixa         → Railway.baixa ('S'/'N'/null)
 * 
 * Execução manual: npx tsx scripts/sync-mysql-railway-v2.ts
 * Cron (5 min): 0,5,10,15,20,25,30,35,40,45,50,55 * * * * cd /path/app && npx tsx scripts/sync-mysql-railway-v2.ts
 */

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

// ==================== CONFIGURAÇÕES ====================
const MYSQL_CONFIG = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
};

const RAILWAY_URL = 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';
const ADMIN_USER_ID = 'cmkftmv2t0000ofs76r8om5z8';

const WORKERS = 50; // Número de workers paralelos
const BATCH_SIZE = 200; // Registros por batch

// ==================== TIPOS ====================
interface SyncResult {
  table: string;
  total: number;
  updated: number;
  inserted: number;
  errors: number;
  duration: number;
}

// ==================== INICIALIZAÇÃO ====================
const railway = new PrismaClient({
  datasources: { db: { url: RAILWAY_URL } }
});

// ==================== UTILITÁRIOS ====================
function log(msg: string) {
  const time = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${time}] ${msg}`);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${seconds}s`;
}

// Divide array em chunks
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ==================== SINCRONIZAÇÃO DE SÓCIOS ====================
async function syncSocios(mysqlConn: mysql.Connection): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = { table: 'socios', total: 0, updated: 0, inserted: 0, errors: 0, duration: 0 };

  log('👥 SINCRONIZANDO SÓCIOS...');

  try {
    // 1. Buscar todos os sócios do Railway com suas matrículas
    const railwaySocios = await railway.socio.findMany({
      where: { userId: ADMIN_USER_ID },
      select: { id: true, matricula: true, updatedAt: true }
    });
    
    const railwayMap = new Map<string, { id: string; updatedAt: Date }>();
    railwaySocios.forEach(s => {
      if (s.matricula) railwayMap.set(s.matricula, { id: s.id, updatedAt: s.updatedAt });
    });
    
    log(`   Railway: ${railwaySocios.length} sócios`);

    // 2. Buscar sócios do MySQL que existem no Railway (pelas matrículas)
    const matriculas = Array.from(railwayMap.keys());
    if (matriculas.length === 0) {
      log('   ⚠️ Nenhum sócio para sincronizar');
      result.duration = Date.now() - startTime;
      return result;
    }

    const [mysqlRows] = await mysqlConn.query<any[]>(`
      SELECT 
        matricula, associado as nome, cpf, rg, endereco, bairro, cep, cidade,
        fone as telefone, celular, email, contato, data as dataCadastro,
        nascimento as dataNascimento, funcao, lotacao, limite, autorizado,
        sexo, est_civil as estadoCivil, ncompras as numCompras, tipo,
        agencia, conta, banco, devolucao, bloqueio, motivo as motivoBloqueio,
        codtipo as codTipo,
        CASE WHEN YEAR(data_exclusao) <= 1899 THEN NULL ELSE data_exclusao END as dataExclusao,
        CASE WHEN YEAR(nascimento)    <= 1899 THEN NULL ELSE nascimento    END as dataNascimento,
        motivo_exclusao as motivoExclusao
      FROM socios 
      WHERE matricula IN (?)
    `, [matriculas]);

    log(`   MySQL: ${mysqlRows.length} sócios correspondentes`);
    result.total = mysqlRows.length;

    // 3. Processar em batches paralelos
    const batches = chunk(mysqlRows, BATCH_SIZE);
    let processed = 0;

    const processBatch = async (batch: any[]) => {
      const batchResults = { updated: 0, errors: 0 };

      await Promise.all(batch.map(async (row) => {
        try {
          const existing = railwayMap.get(row.matricula);
          if (!existing) return;

          // Atualizar no Railway
          await railway.socio.update({
            where: { id: existing.id },
            data: {
              nome: row.nome || undefined,
              cpf: row.cpf || undefined,
              rg: row.rg || undefined,
              endereco: row.endereco || undefined,
              bairro: row.bairro || undefined,
              cep: row.cep || undefined,
              cidade: row.cidade || undefined,
              telefone: row.telefone || undefined,
              celular: row.celular || undefined,
              email: row.email || undefined,
              contato: row.contato || undefined,
              dataNascimento: row.dataNascimento ? new Date(row.dataNascimento) : undefined,
              funcao: row.funcao || undefined,
              lotacao: row.lotacao || undefined,
              limite: row.limite || undefined,
              autorizado: row.autorizado || undefined,
              sexo: row.sexo || undefined,
              estadoCivil: row.estadoCivil || undefined,
              numCompras: row.numCompras ? parseInt(row.numCompras) : undefined,
              tipo: row.tipo || undefined,
              agencia: row.agencia || undefined,
              conta: row.conta || undefined,
              banco: row.banco || undefined,
              devolucao: row.devolucao || undefined,
              bloqueio: row.bloqueio || undefined,
              motivoBloqueio: row.motivoBloqueio || undefined,
              codTipo: row.codTipo || undefined,
              dataExclusao: row.dataExclusao ? new Date(row.dataExclusao) : undefined,
              motivoExclusao: row.motivoExclusao || undefined,
              ativo: row.bloqueio !== 'S',
            }
          });
          batchResults.updated++;
        } catch (error: any) {
          batchResults.errors++;
        }
      }));

      return batchResults;
    };

    // Executar batches com workers limitados
    for (let i = 0; i < batches.length; i += WORKERS) {
      const workerBatches = batches.slice(i, i + WORKERS);
      const results = await Promise.all(workerBatches.map(processBatch));
      
      results.forEach(r => {
        result.updated += r.updated;
        result.errors += r.errors;
      });

      processed += workerBatches.reduce((sum, b) => sum + b.length, 0);
      const progress = ((processed / mysqlRows.length) * 100).toFixed(1);
      process.stdout.write(`\r   ⏳ ${progress}% (${processed}/${mysqlRows.length})`);
    }

    console.log(''); // Nova linha após progresso
    result.duration = Date.now() - startTime;
    log(`   ✅ Sócios: ${result.updated} atualizados, ${result.errors} erros (${formatDuration(result.duration)})`);

  } catch (error: any) {
    log(`   ❌ Erro: ${error.message}`);
    result.errors++;
  }

  return result;
}

// ==================== SINCRONIZAÇÃO DE VENDAS ====================
async function syncVendas(mysqlConn: mysql.Connection): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = { table: 'vendas', total: 0, updated: 0, inserted: 0, errors: 0, duration: 0 };

  log('🛒 SINCRONIZANDO VENDAS...');

  try {
    // 1. Buscar vendas do Railway com socio.matricula
    const railwayVendas = await railway.venda.findMany({
      where: { userId: ADMIN_USER_ID },
      select: { 
        id: true, 
        numeroVenda: true, 
        updatedAt: true,
        socio: { select: { matricula: true } }
      }
    });
    
    // Criar mapa: "matricula-sequencia" -> { id, updatedAt }
    const railwayMap = new Map<string, { id: string; updatedAt: Date }>();
    railwayVendas.forEach(v => {
      if (v.socio.matricula) {
        const key = `${v.socio.matricula}-${v.numeroVenda}`;
        railwayMap.set(key, { id: v.id, updatedAt: v.updatedAt });
      }
    });
    
    log(`   Railway: ${railwayVendas.length} vendas`);

    // 2. Buscar chaves das vendas do Railway para filtrar MySQL
    const keys = Array.from(railwayMap.keys());
    if (keys.length === 0) {
      log('   ⚠️ Nenhuma venda para sincronizar');
      result.duration = Date.now() - startTime;
      return result;
    }

    // Extrair matrículas e sequências únicas
    const matriculasSet = new Set<string>();
    keys.forEach(k => {
      const [matricula] = k.split('-');
      matriculasSet.add(matricula);
    });
    const matriculas = Array.from(matriculasSet);

    // 3. Buscar vendas do MySQL
    const [mysqlRows] = await mysqlConn.query<any[]>(`
      SELECT 
        matricula, sequencia, emissao as dataEmissao, 
        parcelas as quantidadeParcelas, valorparcela as valorParcela,
        operador, cancela, codconven
      FROM vendas 
      WHERE matricula IN (?)
    `, [matriculas]);

    log(`   MySQL: ${mysqlRows.length} vendas correspondentes`);
    result.total = mysqlRows.length;

    // 4. Buscar convênios para mapping
    const conveniosRailway = await railway.convenio.findMany({
      select: { id: true, codigo: true }
    });
    const convenioMap = new Map(conveniosRailway.map(c => [c.codigo, c.id]));

    // 5. Processar em batches paralelos
    const batches = chunk(mysqlRows, BATCH_SIZE);
    let processed = 0;

    const processBatch = async (batch: any[]) => {
      const batchResults = { updated: 0, errors: 0 };

      await Promise.all(batch.map(async (row) => {
        try {
          const key = `${row.matricula}-${row.sequencia}`;
          const existing = railwayMap.get(key);
          if (!existing) return;

          const convenioId = row.codconven ? convenioMap.get(String(row.codconven)) : undefined;
          const valorParcela = parseFloat(row.valorParcela) || 0;
          const qtdParcelas = parseInt(row.quantidadeParcelas) || 0;

          await railway.venda.update({
            where: { id: existing.id },
            data: {
              dataEmissao: row.dataEmissao ? new Date(row.dataEmissao) : undefined,
              quantidadeParcelas: qtdParcelas,
              valorParcela: valorParcela,
              valorTotal: valorParcela * qtdParcelas,
              operador: row.operador || undefined,
              cancelado: row.cancela ? true : false,
              motivoCancelamento: row.cancela || undefined,
              convenioId: convenioId ?? undefined,
            }
          });
          batchResults.updated++;
        } catch (error: any) {
          batchResults.errors++;
        }
      }));

      return batchResults;
    };

    for (let i = 0; i < batches.length; i += WORKERS) {
      const workerBatches = batches.slice(i, i + WORKERS);
      const results = await Promise.all(workerBatches.map(processBatch));
      
      results.forEach(r => {
        result.updated += r.updated;
        result.errors += r.errors;
      });

      processed += workerBatches.reduce((sum, b) => sum + b.length, 0);
      const progress = ((processed / mysqlRows.length) * 100).toFixed(1);
      process.stdout.write(`\r   ⏳ ${progress}% (${processed}/${mysqlRows.length})`);
    }

    console.log('');
    result.duration = Date.now() - startTime;
    log(`   ✅ Vendas: ${result.updated} atualizadas, ${result.errors} erros (${formatDuration(result.duration)})`);

  } catch (error: any) {
    log(`   ❌ Erro: ${error.message}`);
    result.errors++;
  }

  return result;
}

// ==================== SINCRONIZAÇÃO DE PARCELAS ====================
async function syncParcelas(mysqlConn: mysql.Connection): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = { table: 'parcelas', total: 0, updated: 0, inserted: 0, errors: 0, duration: 0 };

  log('📄 SINCRONIZANDO PARCELAS...');

  try {
    // 1. Buscar vendas do Railway para criar mapa de vendaId
    const railwayVendas = await railway.venda.findMany({
      where: { userId: ADMIN_USER_ID },
      select: { 
        id: true, 
        numeroVenda: true,
        socio: { select: { matricula: true } }
      }
    });
    
    const vendaMap = new Map<string, string>();
    railwayVendas.forEach(v => {
      if (v.socio.matricula) {
        const key = `${v.socio.matricula}-${v.numeroVenda}`;
        vendaMap.set(key, v.id);
      }
    });
    
    log(`   Railway: ${railwayVendas.length} vendas mapeadas`);

    // 2. Buscar parcelas do Railway
    const railwayParcelas = await railway.parcela.findMany({
      select: { 
        id: true, 
        vendaId: true,
        numeroParcela: true,
        updatedAt: true 
      }
    });
    
    // Criar mapa: "vendaId-numeroParcela" -> { id, updatedAt }
    const parcelaMap = new Map<string, { id: string; updatedAt: Date }>();
    railwayParcelas.forEach(p => {
      const key = `${p.vendaId}-${p.numeroParcela}`;
      parcelaMap.set(key, { id: p.id, updatedAt: p.updatedAt });
    });
    
    log(`   Railway: ${railwayParcelas.length} parcelas`);

    // 3. Extrair matrículas das vendas
    const matriculasSet = new Set<string>();
    railwayVendas.forEach(v => {
      if (v.socio.matricula) matriculasSet.add(v.socio.matricula);
    });
    const matriculas = Array.from(matriculasSet);

    if (matriculas.length === 0) {
      log('   ⚠️ Nenhuma parcela para sincronizar');
      result.duration = Date.now() - startTime;
      return result;
    }

    // 4. Buscar parcelas do MySQL
    const [mysqlRows] = await mysqlConn.query<any[]>(`
      SELECT 
        matricula, sequencia, nrseq as numeroParcela, 
        vencimento as dataVencimento, valor, baixa, tipo
      FROM parcelas 
      WHERE matricula IN (?)
    `, [matriculas]);

    log(`   MySQL: ${mysqlRows.length} parcelas correspondentes`);
    result.total = mysqlRows.length;

    // 5. Processar em batches paralelos
    const batches = chunk(mysqlRows, BATCH_SIZE);
    let processed = 0;

    const processBatch = async (batch: any[]) => {
      const batchResults = { updated: 0, errors: 0 };

      await Promise.all(batch.map(async (row) => {
        try {
          // Encontrar vendaId
          const vendaKey = `${row.matricula}-${row.sequencia}`;
          const vendaId = vendaMap.get(vendaKey);
          if (!vendaId) return;

          // Verificar se parcela existe
          const numeroParcela = parseInt(row.numeroParcela) || 0;
          const parcelaKey = `${vendaId}-${numeroParcela}`;
          const existing = parcelaMap.get(parcelaKey);
          if (!existing) return;

          await railway.parcela.update({
            where: { id: existing.id },
            data: {
              dataVencimento: row.dataVencimento ? new Date(row.dataVencimento) : undefined,
              valor: parseFloat(row.valor) || undefined,
              baixa: row.baixa || undefined,
              tipo: row.tipo || undefined,
            }
          });
          batchResults.updated++;
        } catch (error: any) {
          batchResults.errors++;
        }
      }));

      return batchResults;
    };

    for (let i = 0; i < batches.length; i += WORKERS) {
      const workerBatches = batches.slice(i, i + WORKERS);
      const results = await Promise.all(workerBatches.map(processBatch));
      
      results.forEach(r => {
        result.updated += r.updated;
        result.errors += r.errors;
      });

      processed += workerBatches.reduce((sum, b) => sum + b.length, 0);
      const progress = ((processed / mysqlRows.length) * 100).toFixed(1);
      process.stdout.write(`\r   ⏳ ${progress}% (${processed}/${mysqlRows.length})`);
    }

    console.log('');
    result.duration = Date.now() - startTime;
    log(`   ✅ Parcelas: ${result.updated} atualizadas, ${result.errors} erros (${formatDuration(result.duration)})`);

  } catch (error: any) {
    log(`   ❌ Erro: ${error.message}`);
    result.errors++;
  }

  return result;
}

// ==================== MAIN ====================
async function main() {
  const startTime = Date.now();

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   🔄 SINCRONIZAÇÃO MYSQL → RAILWAY (v2 - Paralelo)                   ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║   📅 ${new Date().toLocaleString('pt-BR')}                                         ║`);
  console.log(`║   ⚡ Workers: ${WORKERS} | Batch: ${BATCH_SIZE}                                       ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  let mysqlConn: mysql.Connection | null = null;

  try {
    // Conectar ao MySQL
    log('🔌 Conectando ao MySQL...');
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    log('✅ Conectado!\n');

    // Sincronizar tabelas (sequencial para evitar conflitos de FK)
    const sociosResult = await syncSocios(mysqlConn);
    console.log('');
    
    const vendasResult = await syncVendas(mysqlConn);
    console.log('');
    
    const parcelasResult = await syncParcelas(mysqlConn);

    // Resumo
    const totalDuration = Date.now() - startTime;

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SINCRONIZAÇÃO CONCLUÍDA!                       ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║   👥 Sócios:   ${sociosResult.updated.toString().padStart(6)} atualizados | ${sociosResult.errors.toString().padStart(4)} erros       ║`);
    console.log(`║   🛒 Vendas:   ${vendasResult.updated.toString().padStart(6)} atualizadas | ${vendasResult.errors.toString().padStart(4)} erros       ║`);
    console.log(`║   📄 Parcelas: ${parcelasResult.updated.toString().padStart(6)} atualizadas | ${parcelasResult.errors.toString().padStart(4)} erros       ║`);
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║   ⏱️  Tempo total: ${formatDuration(totalDuration).padEnd(20)}                        ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  } catch (error: any) {
    log(`❌ Erro fatal: ${error.message}`);
    process.exit(1);
  } finally {
    if (mysqlConn) await mysqlConn.end();
    await railway.$disconnect();
  }
}

main();

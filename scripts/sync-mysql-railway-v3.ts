/**
 * 🔄 SINCRONIZAÇÃO MYSQL → RAILWAY (v3 - Apenas Alterados)
 * 
 * Sincroniza apenas registros ALTERADOS no MySQL para o Railway.
 * Usa timestamp para detectar mudanças.
 * 
 * Configuração para cron (a cada 5 minutos):
 * 0,5,10,15,20,25,30,35,40,45,50,55 * * * * cd /caminho/app && npx tsx scripts/sync-mysql-railway-v3.ts
 */

import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

const railway = new PrismaClient();

// ==================== CONFIGURAÇÕES ====================
const MYSQL_CONFIG = {
  host: '200.98.112.240',
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
  port: 3306,
};

const ADMIN_USER_ID = 'cmkftmv2t0000ofs76r8om5z8'; // admin@consigexpress.com
const WORKERS = 20; // Trabalhadores paralelos (reduzido para evitar timeout)
const BATCH_SIZE = 100; // Tamanho do batch (reduzido para estabilidade)

// Últimas sincronizações (armazenadas em arquivo)
const LAST_SYNC_FILE = './last-sync.json';

// ==================== TIPOS ====================
interface SyncResult {
  table: string;
  total: number;
  updated: number;
  inserted: number;
  errors: number;
  duration: number;
}

// ==================== UTILS ====================
function log(msg: string) {
  const now = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${now}] ${msg}`);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ==================== SINCRONIZAÇÃO DE SÓCIOS ====================
async function syncSocios(mysqlConn: mysql.Connection): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = { table: 'socios', total: 0, updated: 0, inserted: 0, errors: 0, duration: 0 };

  log('👥 SINCRONIZANDO SÓCIOS...');

  try {
    // 1. Buscar sócios alterados no MySQL nas últimas 24 horas
    const [mysqlRows] = await mysqlConn.query<any[]>(`
      SELECT 
        TRIM(matricula) as matricula, TRIM(associado) as nome, TRIM(fone) as telefone, 
        TRIM(est_civil) as estadoCivil, nascimento as dataNascimento,
        TRIM(cpf) as cpf, TRIM(endereco) as endereco, TRIM(bairro) as bairro, 
        TRIM(cep) as cep, TRIM(cidade) as cidade,
        TRIM(email) as email, TRIM(banco) as banco, TRIM(agencia) as agencia, 
        TRIM(conta) as conta, TRIM(contato) as contato, TRIM(celular) as telefoneContato,
        TRIM(funcao) as cargo
      FROM socios
      WHERE DATE(data) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
         OR data IS NULL
    `);

    if (mysqlRows.length === 0) {
      log('   ℹ️  Nenhum sócio alterado');
      result.duration = Date.now() - startTime;
      return result;
    }

    log(`   MySQL: ${mysqlRows.length} sócios alterados`);
    result.total = mysqlRows.length;

    // 2. Buscar sócios existentes no Railway
    const matriculas = mysqlRows.map(r => r.matricula).filter(Boolean);
    const railwaySocios = await railway.socio.findMany({
      where: { matricula: { in: matriculas } },
      select: { id: true, matricula: true }
    });
    const railwayMap = new Map(railwaySocios.map(s => [s.matricula, s.id]));

    // 3. Processar em batches paralelos
    const batches = chunk(mysqlRows, BATCH_SIZE);
    let processed = 0;

    const processBatch = async (batch: any[]) => {
      const batchResults = { updated: 0, inserted: 0, errors: 0 };

      await Promise.all(batch.map(async (row) => {
        try {
          // Garantir que matricula não tenha espaços
          const matricula = (row.matricula || '').trim();
          if (!matricula) {
            batchResults.errors++;
            return;
          }

          const socioData = {
            nome: row.nome || '',
            telefone: row.telefone || undefined,
            estadoCivil: row.estadoCivil || undefined,
            dataNascimento: row.dataNascimento ? new Date(row.dataNascimento) : undefined,
            cpf: row.cpf || undefined,
            endereco: row.endereco || undefined,
            bairro: row.bairro || undefined,
            cep: row.cep || undefined,
            cidade: row.cidade || undefined,
            email: row.email || undefined,
            banco: row.banco || undefined,
            agencia: row.agencia || undefined,
            conta: row.conta || undefined,
            contato: row.contato || undefined,
            celular: row.telefoneContato || undefined,
            funcao: row.cargo || undefined,
            userId: ADMIN_USER_ID,
          };

          const existingId = railwayMap.get(matricula);
          
          if (existingId) {
            // Atualizar
            await railway.socio.update({
              where: { id: existingId },
              data: socioData
            });
            batchResults.updated++;
          } else {
            // Inserir
            await railway.socio.create({
              data: {
                ...socioData,
                matricula: matricula,
              }
            });
            batchResults.inserted++;
          }
        } catch (error: any) {
          console.error(`\n❌ Erro sócio ${row.matricula}:`, error.message);
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
        result.inserted += r.inserted;
        result.errors += r.errors;
      });

      processed += workerBatches.reduce((sum, b) => sum + b.length, 0);
      const progress = ((processed / mysqlRows.length) * 100).toFixed(1);
      process.stdout.write(`\r   ⏳ ${progress}% (${processed}/${mysqlRows.length})`);
    }

    console.log('');
    result.duration = Date.now() - startTime;
    log(`   ✅ Sócios: ${result.updated} atualizados, ${result.inserted} inseridos, ${result.errors} erros (${formatDuration(result.duration)})`);

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
    // 1. Buscar vendas alteradas no MySQL nas últimas 24 horas
    const [mysqlRows] = await mysqlConn.query<any[]>(`
      SELECT 
        TRIM(matricula) as matricula, TRIM(sequencia) as sequencia, emissao as dataEmissao, 
        parcelas as quantidadeParcelas, valorparcela as valorParcela,
        TRIM(operador) as operador, TRIM(cancela) as cancela, codconven
      FROM vendas 
      WHERE DATE(emissao) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
         OR cancela IS NOT NULL
    `);

    if (mysqlRows.length === 0) {
      log('   ℹ️  Nenhuma venda alterada');
      result.duration = Date.now() - startTime;
      return result;
    }

    log(`   MySQL: ${mysqlRows.length} vendas alteradas`);
    result.total = mysqlRows.length;

    // 2. Buscar sócios e convênios para mapping
    const matriculas = [...new Set(mysqlRows.map(r => r.matricula).filter(Boolean))];
    const sociosRailway = await railway.socio.findMany({
      where: { matricula: { in: matriculas } },
      select: { id: true, matricula: true }
    });
    const socioMap = new Map(sociosRailway.map(s => [s.matricula, s.id]));

    const conveniosRailway = await railway.convenio.findMany({
      select: { id: true, codigo: true }
    });
    const convenioMap = new Map(conveniosRailway.map(c => [c.codigo, c.id]));

    // 3. Buscar vendas existentes no Railway
    const railwayVendas = await railway.venda.findMany({
      where: { 
        socio: { matricula: { in: matriculas } }
      },
      select: { 
        id: true, 
        numeroVenda: true,
        socio: { select: { matricula: true } }
      }
    });
    
    const railwayMap = new Map<string, string>();
    railwayVendas.forEach(v => {
      if (v.socio.matricula) {
        const key = `${v.socio.matricula}-${v.numeroVenda}`;
        railwayMap.set(key, v.id);
      }
    });

    // 4. Processar em batches paralelos
    const batches = chunk(mysqlRows, BATCH_SIZE);
    let processed = 0;

    const processBatch = async (batch: any[]) => {
      const batchResults = { updated: 0, inserted: 0, errors: 0 };

      await Promise.all(batch.map(async (row) => {
        try {
          const matricula = (row.matricula || '').trim();
          const socioId = socioMap.get(matricula);
          if (!socioId) {
            batchResults.errors++;
            return;
          }

          const convenioId = row.codconven ? convenioMap.get(String(row.codconven)) : undefined;
          const valorParcela = parseFloat(row.valorParcela) || 0;
          const qtdParcelas = parseInt(row.quantidadeParcelas) || 0;
          const numeroVenda = parseInt(row.sequencia) || 0;

          const vendaData = {
            dataEmissao: row.dataEmissao ? new Date(row.dataEmissao) : new Date(),
            quantidadeParcelas: qtdParcelas,
            valorParcela: valorParcela,
            valorTotal: valorParcela * qtdParcelas,
            operador: row.operador || undefined,
            cancelado: row.cancela ? true : false,
            motivoCancelamento: row.cancela || undefined,
            convenioId: convenioId,
            socioId: socioId,
            userId: ADMIN_USER_ID,
          };

          const key = `${matricula}-${numeroVenda}`;
          const existingId = railwayMap.get(key);
          
          if (existingId) {
            // Atualizar
            await railway.venda.update({
              where: { id: existingId },
              data: vendaData
            });
            batchResults.updated++;
          } else {
            // Inserir
            await railway.venda.create({
              data: {
                ...vendaData,
                numeroVenda: numeroVenda,
              }
            });
            batchResults.inserted++;
          }
        } catch (error: any) {
          if (batchResults.errors < 3) console.error(`\n❌ Erro venda ${row.matricula}-${row.sequencia}:`, error.message);
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
        result.inserted += r.inserted;
        result.errors += r.errors;
      });

      processed += workerBatches.reduce((sum, b) => sum + b.length, 0);
      const progress = ((processed / mysqlRows.length) * 100).toFixed(1);
      process.stdout.write(`\r   ⏳ ${progress}% (${processed}/${mysqlRows.length})`);
    }

    console.log('');
    result.duration = Date.now() - startTime;
    log(`   ✅ Vendas: ${result.updated} atualizadas, ${result.inserted} inseridas, ${result.errors} erros (${formatDuration(result.duration)})`);

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
    // 1. Buscar vendas do Railway para mapear
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

    const matriculas = [...new Set(railwayVendas.map(v => v.socio.matricula).filter(Boolean))];

    if (matriculas.length === 0) {
      log('   ℹ️  Nenhuma venda para sincronizar parcelas');
      result.duration = Date.now() - startTime;
      return result;
    }

    // 2. Buscar parcelas alteradas no MySQL nas últimas 24 horas
    const [mysqlRows] = await mysqlConn.query<any[]>(`
      SELECT 
        TRIM(matricula) as matricula, TRIM(sequencia) as sequencia, TRIM(nrseq) as numeroParcela,
        vencimento as dataVencimento, valor, baixa
      FROM parcelas 
      WHERE TRIM(matricula) IN (?)
        AND DATE(vencimento) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `, [matriculas]);

    if (mysqlRows.length === 0) {
      log('   ℹ️  Nenhuma parcela alterada');
      result.duration = Date.now() - startTime;
      return result;
    }

    log(`   MySQL: ${mysqlRows.length} parcelas alteradas`);
    result.total = mysqlRows.length;

    // 3. Buscar parcelas existentes no Railway
    const vendaIds = Array.from(vendaMap.values());
    const railwayParcelas = await railway.parcela.findMany({
      where: { vendaId: { in: vendaIds } },
      select: { 
        id: true, 
        numeroParcela: true,
        venda: { 
          select: { 
            numeroVenda: true,
            socio: { select: { matricula: true } }
          } 
        }
      }
    });

    const parcelaMap = new Map<string, string>();
    railwayParcelas.forEach(p => {
      if (p.venda.socio.matricula) {
        const key = `${p.venda.socio.matricula}-${p.venda.numeroVenda}-${p.numeroParcela}`;
        parcelaMap.set(key, p.id);
      }
    });

    // 4. Processar em batches paralelos
    const batches = chunk(mysqlRows, BATCH_SIZE);
    let processed = 0;

    const processBatch = async (batch: any[]) => {
      const batchResults = { updated: 0, inserted: 0, errors: 0 };

      await Promise.all(batch.map(async (row) => {
        try {
          const matricula = (row.matricula || '').trim();
          const numeroVenda = parseInt(row.sequencia) || 0;
          const vendaKey = `${matricula}-${numeroVenda}`;
          const vendaId = vendaMap.get(vendaKey);
          if (!vendaId) {
            if (batchResults.errors < 3) console.error(`\n⚠️ Venda não encontrada para parcela: ${vendaKey}-${row.numeroParcela}`);
            batchResults.errors++;
            return;
          }

          // Validar data de baixa
          let dataBaixa: Date | undefined = undefined;
          if (row.baixa) {
            try {
              const testDate = new Date(row.baixa);
              if (!isNaN(testDate.getTime())) {
                dataBaixa = testDate;
              }
            } catch (e) {
              // Ignorar datas inválidas
            }
          }

          const parcelaData = {
            dataVencimento: row.dataVencimento ? new Date(row.dataVencimento) : new Date(),
            valor: row.valor ? parseFloat(row.valor) : 0,
            baixa: row.baixa ? 'S' : 'N',
            dataBaixa: dataBaixa,
            valorPago: dataBaixa ? parseFloat(row.valor) : undefined,
            vendaId: vendaId,
          };

          const numParcela = parseInt(row.numeroParcela) || 1;
          const key = `${matricula}-${numeroVenda}-${numParcela}`;
          const existingId = parcelaMap.get(key);
          
          if (existingId) {
            // Atualizar
            await railway.parcela.update({
              where: { id: existingId },
              data: parcelaData
            });
            batchResults.updated++;
          } else {
            // Inserir
            await railway.parcela.create({
              data: {
                ...parcelaData,
                numeroParcela: numParcela,
              }
            });
            batchResults.inserted++;
          }
        } catch (error: any) {
          if (batchResults.errors < 3) console.error(`\n❌ Erro parcela ${row.matricula}-${row.sequencia}-${row.numeroParcela}:`, error.message);
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
        result.inserted += r.inserted;
        result.errors += r.errors;
      });

      processed += workerBatches.reduce((sum, b) => sum + b.length, 0);
      const progress = ((processed / mysqlRows.length) * 100).toFixed(1);
      process.stdout.write(`\r   ⏳ ${progress}% (${processed}/${mysqlRows.length})`);
    }

    console.log('');
    result.duration = Date.now() - startTime;
    log(`   ✅ Parcelas: ${result.updated} atualizadas, ${result.inserted} inseridas, ${result.errors} erros (${formatDuration(result.duration)})`);

  } catch (error: any) {
    log(`   ❌ Erro: ${error.message}`);
    result.errors++;
  }

  return result;
}

// ==================== FUNÇÃO PRINCIPAL ====================
async function main() {
  const startTime = Date.now();

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   🔄 SINCRONIZAÇÃO MYSQL → RAILWAY (v3 - Alterados)                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║   📅 ${new Date().toLocaleString('pt-BR').padEnd(64)} ║`);
  console.log(`║   ⚡ Workers: ${WORKERS} | Batch: ${BATCH_SIZE}                                       ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  let mysqlConn: mysql.Connection | null = null;

  try {
    // Conectar ao MySQL
    log('🔌 Conectando ao MySQL...');
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    log('✅ Conectado!\n');

    // Sincronizar tabelas
    const results: SyncResult[] = [];
    
    results.push(await syncSocios(mysqlConn));
    results.push(await syncVendas(mysqlConn));
    results.push(await syncParcelas(mysqlConn));

    // Resumo final
    const totalDuration = Date.now() - startTime;
    
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SINCRONIZAÇÃO CONCLUÍDA!                       ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    
    results.forEach(r => {
      const icon = r.table === 'socios' ? '👥' : r.table === 'vendas' ? '🛒' : '📄';
      const name = r.table.charAt(0).toUpperCase() + r.table.slice(1);
      const stats = `${r.updated} atualizados | ${r.inserted} inseridos | ${r.errors} erros`;
      console.log(`║   ${icon} ${name.padEnd(9)}: ${stats.padEnd(46)} ║`);
    });
    
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║   ⏱️  Tempo total: ${formatDuration(totalDuration).padEnd(50)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  } catch (error: any) {
    console.error(`\n❌ ERRO FATAL: ${error.message}\n`);
    process.exit(1);
  } finally {
    if (mysqlConn) await mysqlConn.end();
    await railway.$disconnect();
  }
}

main();

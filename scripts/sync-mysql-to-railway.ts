// SINCRONIZAÇÃO PARALELA: MySQL → Railway
// 
// Sincroniza alterações do MySQL remoto para o Railway PostgreSQL
// usando processamento paralelo com Promise.all
// 
// Tabelas sincronizadas: socios, vendas, parcelas
// 
// Execução: npx tsx scripts/sync-mysql-to-railway.ts
// Cron (5 min): crontab -e e adicionar:
//   0,5,10,15,20,25,30,35,40,45,50,55 * * * * cd /path/to/app && npx tsx scripts/sync-mysql-to-railway.ts >> /var/log/sync.log 2>&1

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

// Configurações
const MYSQL_CONFIG = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
};

const RAILWAY_URL = 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';
const ADMIN_USER_ID = 'cmkftmv2t0000ofs76r8om5z8';

// Workers paralelos por tabela
const WORKERS_SOCIOS = 20;
const WORKERS_VENDAS = 30;
const WORKERS_PARCELAS = 50;

// Estatísticas
const stats = {
  socios: { inserted: 0, updated: 0, unchanged: 0, errors: 0 },
  vendas: { inserted: 0, updated: 0, unchanged: 0, errors: 0 },
  parcelas: { inserted: 0, updated: 0, unchanged: 0, errors: 0 },
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function log(msg: string) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${timestamp}] ${msg}`);
}

// ============================================
// SINCRONIZAÇÃO DE SÓCIOS
// ============================================

async function syncSocios(mysqlPool: mysql.Pool, prisma: PrismaClient): Promise<void> {
  log('');
  log('👥 SINCRONIZANDO SÓCIOS...');
  
  // Buscar todos os sócios do MySQL (ativos)
  const conn = await mysqlPool.getConnection();
  const [mysqlSocios] = await conn.execute(`
    SELECT * FROM socios 
    WHERE data_exclusao IS NULL OR data_exclusao = '0000-00-00'
  `) as any[];
  conn.release();
  
  log(`   MySQL: ${mysqlSocios.length} sócios ativos`);
  
  // Buscar sócios existentes no Railway por matrícula
  const railwaySocios = await prisma.socio.findMany({
    select: { id: true, matricula: true, nome: true, cpf: true }
  });
  
  const railwayByMatricula = new Map<string, any>();
  railwaySocios.forEach(s => {
    if (s.matricula) {
      railwayByMatricula.set(s.matricula, s);
    }
  });
  
  log(`   Railway: ${railwaySocios.length} sócios`);
  
  // Dividir em chunks para processamento paralelo
  const chunkSize = Math.ceil(mysqlSocios.length / WORKERS_SOCIOS);
  const chunks: any[][] = [];
  for (let i = 0; i < mysqlSocios.length; i += chunkSize) {
    chunks.push(mysqlSocios.slice(i, i + chunkSize));
  }
  
  const startTime = Date.now();
  
  await Promise.all(chunks.map(async (chunk) => {
    for (const mysqlSocio of chunk) {
      try {
        const matricula = String(mysqlSocio.matricula).trim();
        const existing = railwayByMatricula.get(matricula);
        
        const data = {
          nome: mysqlSocio.associado?.trim() || 'SEM NOME',
          cpf: mysqlSocio.cpf?.trim() || null,
          rg: mysqlSocio.rg?.trim() || null,
          endereco: mysqlSocio.endereco?.trim() || null,
          bairro: mysqlSocio.bairro?.trim() || null,
          cep: mysqlSocio.cep?.trim() || null,
          cidade: mysqlSocio.cidade?.trim() || null,
          telefone: mysqlSocio.fone?.trim() || null,
          celular: mysqlSocio.celular?.trim() || null,
          email: mysqlSocio.email?.trim() || null,
          dataNascimento: mysqlSocio.nascimento && mysqlSocio.nascimento !== '0000-00-00' 
            ? new Date(mysqlSocio.nascimento) : null,
          dataCadastro: mysqlSocio.data && mysqlSocio.data !== '0000-00-00'
            ? new Date(mysqlSocio.data) : null,
          funcao: mysqlSocio.funcao?.trim() || null,
          lotacao: mysqlSocio.lotacao?.trim() || null,
          limite: mysqlSocio.limite ? parseFloat(mysqlSocio.limite) : null,
          sexo: mysqlSocio.sexo?.trim() || null,
          estadoCivil: mysqlSocio.est_civil?.trim() || null,
          bloqueio: mysqlSocio.bloqueio?.trim() || null,
          motivoBloqueio: mysqlSocio.motivo?.trim() || null,
        };
        
        if (existing) {
          // Verificar se precisa atualizar (comparar campos principais)
          if (existing.nome !== data.nome || existing.cpf !== data.cpf) {
            await prisma.socio.update({
              where: { id: existing.id },
              data
            });
            stats.socios.updated++;
          } else {
            stats.socios.unchanged++;
          }
        } else {
          // Novo sócio
          await prisma.socio.create({
            data: {
              ...data,
              matricula,
              userId: ADMIN_USER_ID,
              ativo: true,
            }
          });
          stats.socios.inserted++;
        }
      } catch (error: any) {
        if (!error.message?.includes('Unique constraint')) {
          stats.socios.errors++;
        }
      }
    }
  }));
  
  const elapsed = (Date.now() - startTime) / 1000;
  log(`   ✅ Concluído em ${formatTime(elapsed)}`);
  log(`   📊 Inseridos: ${stats.socios.inserted} | Atualizados: ${stats.socios.updated} | Sem alteração: ${stats.socios.unchanged}`);
}

// ============================================
// SINCRONIZAÇÃO DE VENDAS
// ============================================

async function syncVendas(mysqlPool: mysql.Pool, prisma: PrismaClient): Promise<void> {
  log('');
  log('🛒 SINCRONIZANDO VENDAS...');
  
  // Buscar todas as vendas do MySQL
  const conn = await mysqlPool.getConnection();
  const [mysqlVendas] = await conn.execute(`SELECT * FROM vendas ORDER BY id`) as any[];
  conn.release();
  
  log(`   MySQL: ${mysqlVendas.length} vendas`);
  
  // Buscar vendas existentes no Railway
  const railwayVendas = await prisma.venda.findMany({
    select: { 
      id: true, 
      numeroVenda: true,
      socio: { select: { matricula: true } }
    }
  });
  
  // Criar índice por matricula + sequencia
  const railwayVendaKeys = new Set<string>();
  railwayVendas.forEach(v => {
    if (v.socio?.matricula) {
      railwayVendaKeys.add(`${v.socio.matricula}-${v.numeroVenda}`);
    }
  });
  
  log(`   Railway: ${railwayVendas.length} vendas`);
  
  // Mapas para lookup
  const socioMap = new Map<string, string>();
  const socios = await prisma.socio.findMany({
    where: { matricula: { not: null } },
    select: { id: true, matricula: true }
  });
  socios.forEach(s => {
    if (s.matricula) socioMap.set(s.matricula, s.id);
  });
  
  const convenioMap = new Map<number, number>();
  const convenios = await prisma.convenio.findMany({
    select: { id: true, codigo: true }
  });
  convenios.forEach(c => {
    if (c.codigo) convenioMap.set(parseInt(c.codigo), c.id);
  });
  
  // Filtrar apenas vendas novas
  const vendasNovas = mysqlVendas.filter((v: any) => {
    const key = `${v.matricula}-${v.sequencia}`;
    return !railwayVendaKeys.has(key);
  });
  
  log(`   Novas vendas: ${vendasNovas.length}`);
  
  if (vendasNovas.length === 0) {
    log(`   ✅ Nenhuma venda nova`);
    return;
  }
  
  // Processar em paralelo
  const chunkSize = Math.ceil(vendasNovas.length / WORKERS_VENDAS);
  const chunks: any[][] = [];
  for (let i = 0; i < vendasNovas.length; i += chunkSize) {
    chunks.push(vendasNovas.slice(i, i + chunkSize));
  }
  
  const startTime = Date.now();
  
  await Promise.all(chunks.map(async (chunk) => {
    for (const mysqlVenda of chunk) {
      try {
        const matricula = String(mysqlVenda.matricula);
        const socioId = socioMap.get(matricula);
        
        if (!socioId) {
          stats.vendas.errors++;
          continue;
        }
        
        const convenioId = convenioMap.get(mysqlVenda.codconven);
        
        await prisma.venda.create({
          data: {
            numeroVenda: mysqlVenda.sequencia,
            socioId,
            convenioId: convenioId || null,
            dataEmissao: mysqlVenda.emissao && mysqlVenda.emissao !== '0000-00-00'
              ? new Date(mysqlVenda.emissao) : new Date(),
            quantidadeParcelas: mysqlVenda.parcelas || 1,
            valorParcela: mysqlVenda.valorparcela ? parseFloat(mysqlVenda.valorparcela) : 0,
            valorTotal: (mysqlVenda.valorparcela || 0) * (mysqlVenda.parcelas || 1),
            operador: mysqlVenda.operador?.trim() || 'MIGRAÇÃO',
            ativo: !mysqlVenda.cancela,
            cancelado: !!mysqlVenda.cancela,
            userId: ADMIN_USER_ID,
          }
        });
        
        stats.vendas.inserted++;
      } catch (error: any) {
        if (!error.message?.includes('Unique constraint')) {
          stats.vendas.errors++;
        }
      }
    }
  }));
  
  const elapsed = (Date.now() - startTime) / 1000;
  log(`   ✅ Concluído em ${formatTime(elapsed)}`);
  log(`   📊 Inseridas: ${stats.vendas.inserted} | Erros: ${stats.vendas.errors}`);
}

// ============================================
// SINCRONIZAÇÃO DE PARCELAS
// ============================================

async function syncParcelas(mysqlPool: mysql.Pool, prisma: PrismaClient): Promise<void> {
  log('');
  log('📄 SINCRONIZANDO PARCELAS...');
  
  // Contar totais
  const conn = await mysqlPool.getConnection();
  const [[countResult]] = await conn.execute('SELECT COUNT(*) as total FROM parcelas') as any;
  const totalMysql = countResult.total;
  conn.release();
  
  const totalRailway = await prisma.parcela.count();
  
  log(`   MySQL: ${totalMysql.toLocaleString()} parcelas`);
  log(`   Railway: ${totalRailway.toLocaleString()} parcelas`);
  
  if (totalMysql <= totalRailway) {
    log(`   ✅ Parcelas já sincronizadas`);
    return;
  }
  
  // Construir mapa de vendas
  log(`   🔄 Construindo mapa de vendas...`);
  
  const vendas = await prisma.venda.findMany({
    select: { 
      id: true, 
      numeroVenda: true,
      socio: { select: { matricula: true } }
    }
  });
  
  const vendaIdMap = new Map<string, string>();
  vendas.forEach(v => {
    if (v.socio?.matricula) {
      const key = `${v.socio.matricula}-${v.numeroVenda}`;
      vendaIdMap.set(key, v.id);
    }
  });
  
  log(`   ✅ ${vendaIdMap.size} vendas mapeadas`);
  
  // Buscar parcelas existentes
  const existingParcelas = await prisma.parcela.findMany({
    select: { 
      venda: { 
        select: { 
          numeroVenda: true,
          socio: { select: { matricula: true } }
        }
      },
      numeroParcela: true
    }
  });
  
  const existingKeys = new Set<string>();
  existingParcelas.forEach(p => {
    if (p.venda?.socio?.matricula) {
      const key = `${p.venda.socio.matricula}-${p.venda.numeroVenda}-${p.numeroParcela}`;
      existingKeys.add(key);
    }
  });
  
  log(`   ✅ ${existingKeys.size.toLocaleString()} parcelas já existentes`);
  
  // Buscar parcelas do MySQL
  const conn2 = await mysqlPool.getConnection();
  const [mysqlParcelas] = await conn2.execute(`SELECT * FROM parcelas ORDER BY id`) as any[];
  conn2.release();
  
  // Filtrar apenas parcelas novas
  const parcelasNovas = mysqlParcelas.filter((p: any) => {
    const key = `${p.matricula}-${p.sequencia}-${parseInt(p.nrseq)}`;
    return !existingKeys.has(key);
  });
  
  log(`   Novas parcelas: ${parcelasNovas.length.toLocaleString()}`);
  
  if (parcelasNovas.length === 0) {
    log(`   ✅ Nenhuma parcela nova`);
    return;
  }
  
  // Processar em paralelo
  const chunkSize = Math.ceil(parcelasNovas.length / WORKERS_PARCELAS);
  const chunks: any[][] = [];
  for (let i = 0; i < parcelasNovas.length; i += chunkSize) {
    chunks.push(parcelasNovas.slice(i, i + chunkSize));
  }
  
  const startTime = Date.now();
  let processed = 0;
  
  const progressInterval = setInterval(() => {
    const pct = ((processed / parcelasNovas.length) * 100).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed || 0;
    const remaining = rate > 0 ? (parcelasNovas.length - processed) / rate : 0;
    process.stdout.write(`\r   ⏳ ${pct}% (${processed.toLocaleString()}/${parcelasNovas.length.toLocaleString()}) - ${rate.toFixed(0)}/s - ETA: ${formatTime(remaining)}   `);
  }, 1000);
  
  await Promise.all(chunks.map(async (chunk) => {
    for (const mysqlParcela of chunk) {
      try {
        const matricula = String(mysqlParcela.matricula).trim();
        const sequencia = parseInt(mysqlParcela.sequencia);
        const key = `${matricula}-${sequencia}`;
        const vendaId = vendaIdMap.get(key);
        
        if (!vendaId) {
          stats.parcelas.errors++;
          processed++;
          continue;
        }
        
        await prisma.parcela.create({
          data: {
            vendaId,
            numeroParcela: parseInt(mysqlParcela.nrseq) || 1,
            dataVencimento: mysqlParcela.vencimento && mysqlParcela.vencimento !== '0000-00-00'
              ? new Date(mysqlParcela.vencimento) : new Date(),
            valor: mysqlParcela.valor ? parseFloat(mysqlParcela.valor) : 0,
            baixa: mysqlParcela.baixa === 'S' ? new Date() : null,
            userId: ADMIN_USER_ID,
          }
        });
        
        stats.parcelas.inserted++;
        processed++;
      } catch (error: any) {
        if (!error.message?.includes('Unique constraint')) {
          stats.parcelas.errors++;
        }
        processed++;
      }
    }
  }));
  
  clearInterval(progressInterval);
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log('');
  log(`   ✅ Concluído em ${formatTime(elapsed)}`);
  log(`   📊 Inseridas: ${stats.parcelas.inserted.toLocaleString()} | Erros: ${stats.parcelas.errors}`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       🔄 SINCRONIZAÇÃO MYSQL → RAILWAY (PARALELO)                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Workers: Sócios=${WORKERS_SOCIOS} | Vendas=${WORKERS_VENDAS} | Parcelas=${WORKERS_PARCELAS}              ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const startTime = Date.now();
  
  // Conectar MySQL com pool
  const mysqlPool = mysql.createPool({
    ...MYSQL_CONFIG,
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0
  });
  
  // Conectar Railway
  const prisma = new PrismaClient({
    datasources: { db: { url: RAILWAY_URL } }
  });
  
  try {
    // Sincronizar tabelas (sequencial por dependência)
    await syncSocios(mysqlPool, prisma);
    await syncVendas(mysqlPool, prisma);
    await syncParcelas(mysqlPool, prisma);
    
    // Resumo final
    const elapsed = (Date.now() - startTime) / 1000;
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SINCRONIZAÇÃO CONCLUÍDA!                       ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║  👥 Sócios:   +${String(stats.socios.inserted).padStart(5)} inseridos | ~${String(stats.socios.updated).padStart(5)} atualizados       ║`);
    console.log(`║  🛒 Vendas:   +${String(stats.vendas.inserted).padStart(5)} inseridas                                 ║`);
    console.log(`║  📄 Parcelas: +${stats.parcelas.inserted.toLocaleString().padStart(6)} inseridas                               ║`);
    console.log(`║  ⏱️  Tempo total: ${formatTime(elapsed).padEnd(20)}                        ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    
  } finally {
    await mysqlPool.end();
    await prisma.$disconnect();
  }
}

main().catch(console.error);

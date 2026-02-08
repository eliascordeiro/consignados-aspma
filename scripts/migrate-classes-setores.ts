#!/usr/bin/env tsx
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    🚀 MIGRAÇÃO CONFIÁVEL - CLASSES & SETORES                     ║
 * ║    Pool MySQL | createMany | Retry | Idempotente                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Migra tabelas classes e setores do MySQL para Railway PostgreSQL
 * 
 * Padrão v2:
 * - Pool de conexões MySQL (10 conexões máx)
 * - Batch inserts com createMany + skipDuplicates
 * - Retry com exponential backoff
 * - Idempotente (pode ser re-executado)
 */

import mysql from 'mysql2/promise';
import { PrismaClient, Prisma } from '@prisma/client';

const MYSQL_CONFIG = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  waitForConnections: true,
  queueLimit: 0,
};

const BATCH_SIZE = 100;
const MAX_RETRIES = 5;
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000];

// ─────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      
      if (isLastAttempt) {
        console.error(`❌ ${label} - Falhou após ${maxRetries} tentativas`);
        throw error;
      }
      
      const delay = RETRY_DELAYS[attempt - 1];
      console.warn(
        `⚠️  ${label} - Tentativa ${attempt}/${maxRetries} falhou. ` +
        `Aguardando ${delay}ms... (${error.message})`
      );
      await sleep(delay);
    }
  }
  
  throw new Error('Unreachable');
}

// ─────────────────────────────────────────────────────────────────────
// Migração de Classes
// ─────────────────────────────────────────────────────────────────────

async function migrateClasses(
  mysqlPool: mysql.Pool,
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  console.log('\n📦 MIGRANDO CLASSES');
  console.log('─'.repeat(60));
  
  const startTime = Date.now();
  
  // 1. Contar registros no MySQL
  const [[{ total: mysqlCount }]] = await mysqlPool.query<any[]>(
    'SELECT COUNT(*) as total FROM classes'
  );
  console.log(`   MySQL: ${formatNumber(mysqlCount)} registros`);
  
  // 2. Carregar IDs existentes no Railway (idempotente)
  const existingClasses = await prisma.classe.findMany({
    select: { id: true }
  });
  const existingIds = new Set(existingClasses.map(c => c.id));
  console.log(`   Railway: ${formatNumber(existingIds.size)} registros existentes`);
  
  // 3. Buscar todos os registros do MySQL
  const [rows] = await withRetry(
    () => mysqlPool.query<any[]>('SELECT codigo, classe FROM classes ORDER BY codigo'),
    'Buscar classes do MySQL'
  );
  
  // 4. Filtrar apenas novos registros
  const toInsert: Prisma.ClasseCreateManyInput[] = [];
  let skipped = 0;
  
  for (const row of rows) {
    if (existingIds.has(row.codigo)) {
      skipped++;
      continue;
    }
    
    toInsert.push({
      id: row.codigo,
      userId: userId,
      classe: row.classe?.trim() || ''
    });
  }
  
  console.log(`   Para inserir: ${formatNumber(toInsert.length)}`);
  console.log(`   Ignorados (já existem): ${formatNumber(skipped)}`);
  
  // 5. Inserir em batches
  if (toInsert.length > 0) {
    let inserted = 0;
    
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      
      await withRetry(
        async () => {
          const result = await prisma.classe.createMany({
            data: chunk,
            skipDuplicates: true
          });
          inserted += result.count;
        },
        `Inserir batch ${Math.floor(i / BATCH_SIZE) + 1}`
      );
      
      process.stdout.write(
        `\r   Progresso: ${formatNumber(inserted)}/${formatNumber(toInsert.length)}`
      );
    }
    
    console.log();
  }
  
  // 6. Verificação final
  const finalCount = await prisma.classe.count();
  const duration = Date.now() - startTime;
  
  console.log(`\n   ✅ Concluído em ${formatDuration(duration)}`);
  console.log(`   📊 Railway: ${formatNumber(finalCount)} registros`);
  
  if (finalCount < mysqlCount) {
    console.warn(`   ⚠️  ATENÇÃO: Railway tem menos registros que MySQL!`);
    console.warn(`   MySQL: ${formatNumber(mysqlCount)} | Railway: ${formatNumber(finalCount)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Migração de Setores
// ─────────────────────────────────────────────────────────────────────

async function migrateSetores(
  mysqlPool: mysql.Pool,
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  console.log('\n📦 MIGRANDO SETORES');
  console.log('─'.repeat(60));
  
  const startTime = Date.now();
  
  // 1. Contar registros no MySQL
  const [[{ total: mysqlCount }]] = await mysqlPool.query<any[]>(
    'SELECT COUNT(*) as total FROM setores'
  );
  console.log(`   MySQL: ${formatNumber(mysqlCount)} registros`);
  
  // 2. Carregar registros existentes no Railway (idempotente)
  // Como não há chave única natural, usamos combinação codigo+setores
  const existingSetores = await prisma.setor.findMany({
    select: { codigo: true, setores: true }
  });
  const existingKeys = new Set(
    existingSetores.map(s => `${s.codigo}-${s.setores}`)
  );
  console.log(`   Railway: ${formatNumber(existingKeys.size)} registros existentes`);
  
  // 3. Buscar todos os registros do MySQL
  const [rows] = await withRetry(
    () => mysqlPool.query<any[]>('SELECT codigo, setores FROM setores'),
    'Buscar setores do MySQL'
  );
  
  // 4. Filtrar apenas novos registros
  const toInsert: Prisma.SetorCreateManyInput[] = [];
  let skipped = 0;
  
  for (const row of rows) {
    const codigo = row.codigo?.trim() || '';
    const setores = row.setores?.trim() || null;
    const key = `${codigo}-${setores}`;
    
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    
    toInsert.push({ userId, codigo, setores });
  }
  
  console.log(`   Para inserir: ${formatNumber(toInsert.length)}`);
  console.log(`   Ignorados (já existem): ${formatNumber(skipped)}`);
  
  // 5. Inserir em batches
  if (toInsert.length > 0) {
    let inserted = 0;
    
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      
      await withRetry(
        async () => {
          const result = await prisma.setor.createMany({
            data: chunk,
            skipDuplicates: true
          });
          inserted += result.count;
        },
        `Inserir batch ${Math.floor(i / BATCH_SIZE) + 1}`
      );
      
      process.stdout.write(
        `\r   Progresso: ${formatNumber(inserted)}/${formatNumber(toInsert.length)}`
      );
    }
    
    console.log();
  }
  
  // 6. Verificação final
  const finalCount = await prisma.setor.count();
  const duration = Date.now() - startTime;
  
  console.log(`\n   ✅ Concluído em ${formatDuration(duration)}`);
  console.log(`   📊 Railway: ${formatNumber(finalCount)} registros`);
  
  if (finalCount < mysqlCount) {
    console.warn(`   ⚠️  ATENÇÃO: Railway tem menos registros que MySQL!`);
    console.warn(`   MySQL: ${formatNumber(mysqlCount)} | Railway: ${formatNumber(finalCount)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 MIGRAÇÃO CONFIÁVEL - CLASSES & SETORES                     ║');
  console.log('║    Pool MySQL | createMany | Retry | Idempotente                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const totalStartTime = Date.now();
  
  // Criar pool MySQL
  const mysqlPool = mysql.createPool(MYSQL_CONFIG);
  
  // Criar Prisma client conectado no Railway
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
      }
    }
  });
  
  try {
    // Testar conexões
    console.log('\n🔌 Testando conexões...');
    await mysqlPool.query('SELECT 1');
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✅ MySQL conectado');
    console.log('   ✅ Railway conectado');
    
    // Buscar userId padrão (primeiro ADMIN ou MANAGER do Railway)
    console.log('\n👤 Buscando userId padrão...');
    const defaultUser = await prisma.users.findFirst({
      where: {
        OR: [
          { role: 'ADMIN' },
          { role: 'MANAGER' }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!defaultUser) {
      throw new Error('❌ Nenhum usuário ADMIN ou MANAGER encontrado no Railway!');
    }

    console.log(`   ✅ Usando userId: ${defaultUser.id} (${defaultUser.name} - ${defaultUser.role})`);
    
    // Verificar se tabelas existem no Railway
    console.log('\n🔍 Verificando tabelas no Railway...');
    try {
      await prisma.$queryRaw`SELECT 1 FROM classes LIMIT 1`;
      console.log('   ✅ Tabela classes existe');
    } catch (error) {
      console.error('   ❌ Tabela classes não existe!');
      console.error('   Execute: npx prisma db push');
      throw error;
    }
    
    try {
      await prisma.$queryRaw`SELECT 1 FROM setores LIMIT 1`;
      console.log('   ✅ Tabela setores existe');
    } catch (error) {
      console.error('   ❌ Tabela setores não existe!');
      console.error('   Execute: npx prisma db push');
      throw error;
    }
    
    // Migrar classes
    await migrateClasses(mysqlPool, prisma, defaultUser.id);
    
    // Migrar setores
    await migrateSetores(mysqlPool, prisma, defaultUser.id);
    
    // Resumo final
    const totalDuration = Date.now() - totalStartTime;
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('═'.repeat(60));
    console.log(`⏱️  Tempo total: ${formatDuration(totalDuration)}`);
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRO NA MIGRAÇÃO:', error);
    throw error;
  } finally {
    await mysqlPool.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script finalizado com erro:', error);
    process.exit(1);
  });

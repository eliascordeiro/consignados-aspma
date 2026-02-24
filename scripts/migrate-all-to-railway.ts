#!/usr/bin/env tsx
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    🚀 MIGRAÇÃO UNIFICADA - MySQL → Railway                       ║
 * ║    Classes | Setores | Consignatárias | Convênios | Sócios       ║
 * ║    Ordem correta de FK | Idempotente | Retry                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Unifica os 3 scripts de migração em um só:
 *   1. migrate-classes-setores.ts
 *   2. migrate-consignatarias-convenios-railway.ts
 *   3. migrate-socios-local-to-railway.ts
 * 
 * Ordem de limpeza (respeitando FK):
 *   parcelas → vendas → sócios → empresas → convênios → classes → setores
 * 
 * Ordem de inserção:
 *   classes → setores → empresas → convênios → sócios
 * 
 * Uso: npx tsx app/scripts/migrate-all-to-railway.ts
 */

import mysql from 'mysql2/promise';
import { PrismaClient, Prisma } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────
// Configurações
// ─────────────────────────────────────────────────────────────────────

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

const RAILWAY_URL = 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';
const LOCAL_URL = 'postgresql://postgres:postgres@localhost:5432/consignados_dev?schema=public';

const BATCH_SIZE = 100;
const MAX_RETRIES = 5;
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000];

// ─────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function duration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m ${secs}s`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === MAX_RETRIES) {
        console.error(`   ❌ ${label} - Falhou após ${MAX_RETRIES} tentativas`);
        throw error;
      }
      const delay = RETRY_DELAYS[attempt - 1];
      console.warn(`   ⚠️  ${label} - Tentativa ${attempt}/${MAX_RETRIES} falhou. Retry em ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

function separator(title: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
}

// ─────────────────────────────────────────────────────────────────────
// ETAPA 1: Limpeza do Railway (ordem correta de FK)
// ─────────────────────────────────────────────────────────────────────

async function limparRailway(railway: PrismaClient): Promise<void> {
  separator('🗑️  ETAPA 1: LIMPANDO RAILWAY (respeitando FK)');
  
  // 1. Parcelas (dependem de vendas)
  console.log('\n   🗑️  Limpando parcelas...');
  const parcelas = await railway.parcela.deleteMany({});
  console.log(`   ✅ ${fmt(parcelas.count)} parcelas removidas`);

  // 2. Vendas (dependem de sócios)
  console.log('   🗑️  Limpando vendas...');
  const vendas = await railway.venda.deleteMany({});
  console.log(`   ✅ ${fmt(vendas.count)} vendas removidas`);

  // 3. Sócios (dependem de empresas)
  console.log('   🗑️  Limpando sócios...');
  const socios = await railway.socio.deleteMany({});
  console.log(`   ✅ ${fmt(socios.count)} sócios removidos`);

  // 4. Empresas
  console.log('   🗑️  Limpando empresas...');
  const empresas = await railway.empresa.deleteMany({});
  console.log(`   ✅ ${fmt(empresas.count)} empresas removidas`);

  // 5. Convênios
  console.log('   🗑️  Limpando convênios...');
  const convenios = await railway.convenio.deleteMany({});
  console.log(`   ✅ ${fmt(convenios.count)} convênios removidos`);

  // 6. Classes
  console.log('   🗑️  Limpando classes...');
  const classes = await railway.classe.deleteMany({});
  console.log(`   ✅ ${fmt(classes.count)} classes removidas`);

  // 7. Setores
  console.log('   🗑️  Limpando setores...');
  const setores = await railway.setor.deleteMany({});
  console.log(`   ✅ ${fmt(setores.count)} setores removidos`);
}

// ─────────────────────────────────────────────────────────────────────
// ETAPA 2: Migrar Classes (MySQL → Railway)
// ─────────────────────────────────────────────────────────────────────

async function migrarClasses(
  mysqlPool: mysql.Pool,
  railway: PrismaClient,
  userId: string
): Promise<number> {
  separator('📦 ETAPA 2: MIGRANDO CLASSES (MySQL → Railway)');

  const [rows] = await withRetry(
    () => mysqlPool.query<any[]>('SELECT codigo, classe FROM classes ORDER BY codigo'),
    'Buscar classes do MySQL'
  );

  console.log(`\n   MySQL: ${fmt(rows.length)} classes encontradas`);

  const data: Prisma.ClasseCreateManyInput[] = rows.map((row: any) => ({
    id: row.codigo,
    userId,
    classe: row.classe?.trim() || ''
  }));

  const result = await railway.classe.createMany({ data, skipDuplicates: true });
  console.log(`   ✅ ${fmt(result.count)} classes inseridas`);

  return result.count;
}

// ─────────────────────────────────────────────────────────────────────
// ETAPA 3: Migrar Setores (MySQL → Railway)
// ─────────────────────────────────────────────────────────────────────

async function migrarSetores(
  mysqlPool: mysql.Pool,
  railway: PrismaClient,
  userId: string
): Promise<number> {
  separator('📦 ETAPA 3: MIGRANDO SETORES (MySQL → Railway)');

  const [rows] = await withRetry(
    () => mysqlPool.query<any[]>('SELECT codigo, setores FROM setores'),
    'Buscar setores do MySQL'
  );

  console.log(`\n   MySQL: ${fmt(rows.length)} setores encontrados`);

  const data: Prisma.SetorCreateManyInput[] = rows.map((row: any) => ({
    userId,
    codigo: row.codigo?.trim() || '',
    setores: row.setores?.trim() || null
  }));

  // Inserir em batches
  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const result = await railway.setor.createMany({ data: chunk, skipDuplicates: true });
    inserted += result.count;
  }

  console.log(`   ✅ ${fmt(inserted)} setores inseridos`);
  return inserted;
}

// ─────────────────────────────────────────────────────────────────────
// ETAPA 4: Migrar Consignatárias → Empresas (MySQL → Railway)
// ─────────────────────────────────────────────────────────────────────

async function migrarEmpresas(
  mysqlPool: mysql.Pool,
  railway: PrismaClient,
  userId: string
): Promise<Map<number, number>> {
  separator('📦 ETAPA 4: MIGRANDO CONSIGNATÁRIAS → EMPRESAS (MySQL → Railway)');

  const [consignatarias] = await withRetry(
    () => mysqlPool.query<any[]>('SELECT * FROM consignatarias ORDER BY id'),
    'Buscar consignatárias do MySQL'
  );

  console.log(`\n   MySQL: ${fmt(consignatarias.length)} consignatárias encontradas`);

  const consignatariaIdMap = new Map<number, number>();
  let criadas = 0;
  let erros = 0;

  for (const consig of consignatarias) {
    try {
      const empresa = await railway.empresa.create({
        data: {
          userId,
          nome: consig.razao_social?.trim() || consig.nome?.trim() || 'Sem nome',
          cnpj: consig.cnpj?.trim() || consig.cgc?.trim() || null,
          tipo: 'PUBLICO',
          telefone: consig.telefone?.trim() || consig.fone?.trim() || null,
          email: consig.email?.trim() || null,
          contato: consig.contato?.trim() || null,
          cep: consig.cep?.trim() || null,
          rua: consig.rua?.trim() || consig.endereco?.trim() || null,
          numero: consig.numero?.trim() || null,
          bairro: consig.bairro?.trim() || null,
          cidade: consig.cidade?.trim() || null,
          uf: consig.uf?.trim() || null,
          ativo: true,
        }
      });

      consignatariaIdMap.set(consig.id, empresa.id);
      criadas++;
      
      if (criadas % 10 === 0 || criadas === consignatarias.length) {
        process.stdout.write(`\r   Progresso: ${fmt(criadas)}/${fmt(consignatarias.length)}`);
      }
    } catch (error: any) {
      erros++;
      console.log(`\n   ⚠️  Erro ao criar empresa: ${consig.razao_social || consig.nome} - ${error.message}`);
    }
  }

  console.log(`\n   ✅ ${fmt(criadas)} empresas criadas (${erros} erros)`);
  return consignatariaIdMap;
}

// ─────────────────────────────────────────────────────────────────────
// ETAPA 5: Migrar Convênios (MySQL → Railway)
// ─────────────────────────────────────────────────────────────────────

async function migrarConvenios(
  mysqlPool: mysql.Pool,
  railway: PrismaClient,
  userId: string
): Promise<number> {
  separator('📦 ETAPA 5: MIGRANDO CONVÊNIOS (MySQL → Railway)');

  const [convenios] = await withRetry(
    () => mysqlPool.query<any[]>('SELECT * FROM convenio ORDER BY id'),
    'Buscar convênios do MySQL'
  );

  console.log(`\n   MySQL: ${fmt(convenios.length)} convênios encontrados`);

  let criados = 0;
  let erros = 0;

  for (const conv of convenios) {
    try {
      await railway.convenio.create({
        data: {
          // userId do MANAGER que gerencia os convênios (dados visíveis na tela)
          userId,
          codigo: conv.codigo?.trim() || null,
          data: conv.data ? new Date(conv.data) : null,
          razao_soc: conv.razao_soc?.trim() || 'Sem razão social',
          fantasia: conv.fantasia?.trim() || null,
          desconto: conv.desconto ? parseFloat(conv.desconto) : null,
          cgc: conv.cgc?.trim() || null,
          ie: conv.ie?.trim() || null,
          cpf: conv.cpf?.trim() || null,
          rg: conv.rg?.trim() || null,
          endereco: conv.endereco?.trim() || null,
          bairro: conv.bairro?.trim() || null,
          cep: conv.cep?.trim() || null,
          cidade: conv.cidade?.trim() || null,
          uf: conv.uf?.trim() || null,
          fone: conv.fone?.trim() || null,
          fax: conv.fax?.trim() || null,
          contato: conv.contato?.trim() || null,
          agencia: conv.agencia?.trim() || null,
          conta: conv.conta?.trim() || null,
          banco: conv.banco?.trim() || null,
          usuario: conv.usuario?.trim() || null,
          senha: conv.senha?.trim() || null,
          parcelas: conv.parcelas || null,
          mensagem: conv.mensagem?.trim() || null,
          libera: conv.libera?.trim() || null,
          cnpj: conv.cnpj?.trim() || conv.cgc?.trim() || null,
          email: conv.email?.trim() || null,
          tipo: conv.tipo?.trim() || null,
        }
      });
      criados++;

      if (criados % 10 === 0 || criados === convenios.length) {
        process.stdout.write(`\r   Progresso: ${fmt(criados)}/${fmt(convenios.length)}`);
      }
    } catch (error: any) {
      erros++;
      console.log(`\n   ⚠️  Erro ao criar convênio: ${conv.razao_soc} - ${error.message}`);
    }
  }

  console.log(`\n   ✅ ${fmt(criados)} convênios criados (${erros} erros)`);
  return criados;
}

// ─────────────────────────────────────────────────────────────────────
// ETAPA 6: Migrar Sócios (Local PostgreSQL → Railway)
// ─────────────────────────────────────────────────────────────────────

async function migrarSocios(
  local: PrismaClient,
  railway: PrismaClient,
  userId: string
): Promise<{ migrated: number; mapeados: number; semEmpresa: number }> {
  separator('📦 ETAPA 6: MIGRANDO SÓCIOS (Local → Railway)');

  // Buscar empresas do Railway para mapeamento
  const empresaPrefeitura = await railway.empresa.findFirst({
    where: { nome: { contains: 'PREFEITURA MUNICIPAL', mode: 'insensitive' } }
  });
  const empresaFundo = await railway.empresa.findFirst({
    where: { nome: { contains: 'FUNDO DE PREVIDENCIA', mode: 'insensitive' } }
  });

  if (empresaPrefeitura) {
    console.log(`\n   ✅ PREFEITURA encontrada ID: ${empresaPrefeitura.id}`);
  } else {
    console.log(`\n   ⚠️  PREFEITURA não encontrada`);
  }
  if (empresaFundo) {
    console.log(`   ✅ FUNDO encontrado ID: ${empresaFundo.id}`);
  } else {
    console.log(`   ⚠️  FUNDO não encontrado`);
  }

  // Construir mapa Local empresaId → Railway empresaId
  // Busca todas as empresas do Railway para mapear por nome
  const empresasRailway = await railway.empresa.findMany({ select: { id: true, nome: true } });
  const empresasLocal = await local.empresa.findMany({ select: { id: true, nome: true } });
  
  const empresaIdMap: Record<number, number | null> = {};
  for (const el of empresasLocal) {
    const match = empresasRailway.find(er => 
      er.nome.toLowerCase().trim() === el.nome.toLowerCase().trim()
    );
    empresaIdMap[el.id] = match ? match.id : null;
    console.log(`   📎 Mapa empresa: ${el.nome} (local ${el.id}) → ${match ? `railway ${match.id}` : '❌ sem correspondência'}`);
  }

  // Buscar sócios do Local
  const sociosLocal = await local.socio.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`\n   Local: ${fmt(sociosLocal.length)} sócios encontrados`);

  let migrated = 0;
  let sociosComEmpresaMapeada = 0;
  let sociosSemEmpresaFinal = 0;

  for (let i = 0; i < sociosLocal.length; i += BATCH_SIZE) {
    const batch = sociosLocal.slice(i, i + BATCH_SIZE);

    const batchMapeado = batch.map(socio => {
      let empresaId: number | null = null;

      // 1. Se o sócio já tem empresaId do local, mapear para o Railway
      if (socio.empresaId && empresaIdMap[socio.empresaId] !== undefined) {
        empresaId = empresaIdMap[socio.empresaId];
        if (empresaId) sociosComEmpresaMapeada++;
      }

      // 2. Se não mapeou (ou mapeou para null), usar fallback por tipo
      if (!empresaId && socio.tipo) {
        if (socio.tipo === '1' && empresaPrefeitura) {
          empresaId = empresaPrefeitura.id;
          sociosComEmpresaMapeada++;
        } else if ((socio.tipo === '3' || socio.tipo === '4') && empresaFundo) {
          empresaId = empresaFundo.id;
          sociosComEmpresaMapeada++;
        } else {
          sociosSemEmpresaFinal++;
        }
      } else if (!empresaId) {
        sociosSemEmpresaFinal++;
      }

      return { ...socio, empresaId, userId };
    });

    await railway.socio.createMany({ data: batchMapeado, skipDuplicates: true });
    migrated += batch.length;

    if (migrated % 500 === 0 || migrated === sociosLocal.length) {
      process.stdout.write(`\r   Progresso: ${fmt(migrated)}/${fmt(sociosLocal.length)}`);
    }
  }

  console.log(`\n   ✅ ${fmt(migrated)} sócios migrados`);
  console.log(`   📊 Mapeados por tipo: ${fmt(sociosComEmpresaMapeada)}`);
  console.log(`   ⚠️  Sem empresa: ${fmt(sociosSemEmpresaFinal)}`);

  return { migrated, mapeados: sociosComEmpresaMapeada, semEmpresa: sociosSemEmpresaFinal };
}

// ─────────────────────────────────────────────────────────────────────
// VERIFICAÇÃO FINAL
// ─────────────────────────────────────────────────────────────────────

async function verificacaoFinal(railway: PrismaClient): Promise<void> {
  separator('🔍 VERIFICAÇÃO FINAL');

  const classes = await railway.classe.count();
  const setores = await railway.setor.count();
  const empresas = await railway.empresa.count();
  const convenios = await railway.convenio.count();
  const socios = await railway.socio.count();
  const vendas = await railway.venda.count();
  const parcelas = await railway.parcela.count();

  console.log(`\n   📊 Classes:       ${fmt(classes)}`);
  console.log(`   📊 Setores:       ${fmt(setores)}`);
  console.log(`   📊 Empresas:      ${fmt(empresas)}`);
  console.log(`   📊 Convênios:     ${fmt(convenios)}`);
  console.log(`   📊 Sócios:        ${fmt(socios)}`);
  console.log(`   📊 Vendas:        ${fmt(vendas)}`);
  console.log(`   📊 Parcelas:      ${fmt(parcelas)}`);
}

// ─────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 MIGRAÇÃO UNIFICADA - MySQL + Local → Railway                   ║');
  console.log('║    Classes | Setores | Empresas | Convênios | Sócios                ║');
  console.log('║    Ordem FK | Idempotente | Retry | Batch                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const totalStart = Date.now();

  // Criar conexões
  const mysqlPool = mysql.createPool(MYSQL_CONFIG);

  const railway = new PrismaClient({
    datasources: { db: { url: RAILWAY_URL } }
  });

  const local = new PrismaClient({
    datasources: { db: { url: LOCAL_URL } }
  });

  try {
    // Testar conexões
    console.log('\n🔌 Testando conexões...');
    await mysqlPool.query('SELECT 1');
    console.log('   ✅ MySQL remoto conectado');
    await railway.$queryRaw`SELECT 1`;
    console.log('   ✅ Railway conectado');
    await local.$queryRaw`SELECT 1`;
    console.log('   ✅ Local conectado');

    // Buscar userId padrão
    console.log('\n👤 Buscando userId padrão...');
    const defaultUser = await railway.users.findFirst({
      where: { OR: [{ role: 'ADMIN' }, { role: 'MANAGER' }] },
      orderBy: { createdAt: 'asc' }
    });

    if (!defaultUser) {
      throw new Error('❌ Nenhum usuário ADMIN ou MANAGER encontrado no Railway!');
    }
    console.log(`   ✅ userId: ${defaultUser.id} (${defaultUser.name} - ${defaultUser.role})`);

    // ═══════════════════════════════════════════════════════════════
    // EXECUTAR MIGRAÇÃO
    // ═══════════════════════════════════════════════════════════════

    // ETAPA 1: Limpar Railway
    await limparRailway(railway);

    // ETAPA 2: Classes
    const classesCount = await migrarClasses(mysqlPool, railway, defaultUser.id);

    // ETAPA 3: Setores
    const setoresCount = await migrarSetores(mysqlPool, railway, defaultUser.id);

    // ETAPA 4: Empresas (consignatárias)
    const consigMap = await migrarEmpresas(mysqlPool, railway, defaultUser.id);

    // ETAPA 5: Convênios (com userId do MANAGER para serem visíveis na tela)
    const conveniosCount = await migrarConvenios(mysqlPool, railway, defaultUser.id);

    // ETAPA 6: Sócios
    const sociosResult = await migrarSocios(local, railway, defaultUser.id);

    // VERIFICAÇÃO
    await verificacaoFinal(railway);

    // ═══════════════════════════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════════════════════════

    const totalDuration = Date.now() - totalStart;

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║               ✅ MIGRAÇÃO UNIFICADA CONCLUÍDA!                       ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║  📦 Classes:       ${String(classesCount).padStart(6)} inseridas                              ║`);
    console.log(`║  📦 Setores:       ${String(setoresCount).padStart(6)} inseridos                              ║`);
    console.log(`║  📦 Empresas:      ${String(consigMap.size).padStart(6)} criadas                               ║`);
    console.log(`║  📦 Convênios:     ${String(conveniosCount).padStart(6)} criados                               ║`);
    console.log(`║  📦 Sócios:        ${String(sociosResult.migrated).padStart(6)} migrados                              ║`);
    console.log(`║  ⏱️  Tempo total:   ${duration(totalDuration).padStart(10)}                                   ║`);
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log('║  💡 Próximo passo: npx tsx app/scripts/migrate-vendas-parcelas-v2.ts ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ ERRO NA MIGRAÇÃO:', error);
    throw error;
  } finally {
    await mysqlPool.end();
    await railway.$disconnect();
    await local.$disconnect();
    console.log('\n🔌 Todas as conexões fechadas');
  }
}

main()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script finalizado com erro:', error.message);
    process.exit(1);
  });

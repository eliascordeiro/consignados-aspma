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
 *   3. migrate-socios-mysql-to-railway.ts (CORRIGIDO)
 * 
 * Ordem de limpeza (respeitando FK):
 *   parcelas → vendas → sócios → empresas → convênios → classes → setores
 * 
 * Ordem de inserção:
 *   classes → setores → empresas → convênios → sócios (TODOS DO MYSQL)
 * 
 * CORREÇÃO: Sócios agora são migrados do MySQL direto, não do PostgreSQL local
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
// ETAPA 6: Migrar Sócios (MySQL → Railway)
// ─────────────────────────────────────────────────────────────────────

async function migrarSocios(
  mysqlPool: mysql.Pool,
  railway: PrismaClient,
  userId: string,
  consignatariaIdMap: Map<number, number>
): Promise<{ migrated: number; mapeados: number; semEmpresa: number }> {
  separator('📦 ETAPA 6: MIGRANDO SÓCIOS (MySQL → Railway)');

  // Buscar sócios do MySQL
  const [sociosMySQL] = await withRetry(
    () => mysqlPool.query<any[]>('SELECT * FROM socios ORDER BY matricula'),
    'Buscar sócios do MySQL'
  );

  console.log(`\n   MySQL: ${fmt(sociosMySQL.length)} sócios encontrados`);

  // Criar mapeamento consignataria -> empresa para facilitar
  const consigToEmpresa = new Map<number, number>();
  
  // Buscar empresas Railway para mapeamento reverso
  const empresas = await railway.empresa.findMany({
    where: { userId },
    select: { id: true, nome: true }
  });

  // Mapear NENHUMA, FUNDO, PREFEITURA
  for (const empresa of empresas) {
    const nomeUpper = empresa.nome.trim().toUpperCase();
    if (nomeUpper.includes('NENHUMA')) {
      consigToEmpresa.set(0, empresa.id);
    } else if (nomeUpper.includes('FUNDO')) {
      consigToEmpresa.set(1, empresa.id);
    } else if (nomeUpper.includes('PREFEITURA')) {
      consigToEmpresa.set(2, empresa.id);
    }
  }

  // Adicionar empresas do mapeamento de consignatarias
  for (const [mysqlId, railwayId] of consignatariaIdMap.entries()) {
    consigToEmpresa.set(mysqlId, railwayId);
  }

  console.log(`\n   📋 Mapeamento de consignatárias: ${consigToEmpresa.size} entradas`);

  let migrated = 0;
  let sociosComEmpresa = 0;
  let sociosSemEmpresa = 0;

  for (let i = 0; i < sociosMySQL.length; i += BATCH_SIZE) {
    const batch = sociosMySQL.slice(i, i + BATCH_SIZE);

    const batchData = batch.map((socio: any) => {
      const consignatariaId = socio.consignataria || 0;
      const empresaId = consigToEmpresa.get(consignatariaId);

      if (empresaId) {
        sociosComEmpresa++;
      } else {
        sociosSemEmpresa++;
      }

      return {
        userId,
        empresaId: empresaId || null,
        nome: socio.associado?.trim() || 'SEM NOME',
        cpf: socio.cpf?.trim().replace(/[^\d]/g, '') || null,
        rg: socio.rg?.trim() || null,
        matricula: socio.matricula?.trim() || null,
        funcao: socio.funcao?.trim() || null,
        lotacao: socio.lotacao?.trim() || null,
        endereco: socio.endereco?.trim() || null,
        bairro: socio.bairro?.trim() || null,
        cep: socio.cep?.trim() || null,
        cidade: socio.cidade?.trim() || null,
        telefone: socio.fone?.trim() || null,
        celular: socio.celular?.trim() || null,
        email: socio.email?.trim() || null,
        contato: socio.contato?.trim() || null,
        dataCadastro: socio.data || null,
        dataNascimento: socio.nascimento || null,
        limite: socio.limite ? parseFloat(socio.limite) : null,
        margemConsig: socio.mensal ? parseFloat(socio.mensal) : null,
        gratificacao: socio.gratif ? parseFloat(socio.gratif) : null,
        autorizado: socio.autorizado?.trim() || null,
        sexo: socio.sexo?.trim() || null,
        estadoCivil: socio.est_civil?.trim() || null,
        numCompras: socio.ncompras ? Math.floor(socio.ncompras) : null,
        tipo: socio.tipo?.trim() || null,
        agencia: socio.agencia?.trim() || null,
        conta: socio.conta?.trim() || null,
        banco: socio.banco?.trim() || null,
        devolucao: socio.devolucao ? parseFloat(socio.devolucao) : null,
        bloqueio: socio.bloqueio?.trim() || null,
        motivoBloqueio: socio.motivo?.trim() || null,
        codTipo: socio.codtipo || null,
        senha: socio.senha?.toString().trim() || null,
        dataExclusao: socio.data_exclusao || null,
        motivoExclusao: socio.motivo_exclusao?.trim() || null,
        ativo: !socio.bloqueio || socio.bloqueio.trim() === ''
      };
    });

    await railway.socio.createMany({ data: batchData, skipDuplicates: true });
    migrated += batch.length;

    if (migrated % 500 === 0 || migrated === sociosMySQL.length) {
      process.stdout.write(`\r   Progresso: ${fmt(migrated)}/${fmt(sociosMySQL.length)}`);
    }
  }

  console.log(`\n   ✅ ${fmt(migrated)} sócios migrados`);
  console.log(`   📊 Com empresa: ${fmt(sociosComEmpresa)}`);
  console.log(`   ⚠️  Sem empresa: ${fmt(sociosSemEmpresa)}`);

  return { migrated, mapeados: sociosComEmpresa, semEmpresa: sociosSemEmpresa };
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
  console.log('║    🚀 MIGRAÇÃO UNIFICADA - MySQL → Railway                           ║');
  console.log('║    Classes | Setores | Empresas | Convênios | Sócios                ║');
  console.log('║    Ordem FK | Idempotente | Retry | Batch                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const totalStart = Date.now();

  // Criar conexões
  const mysqlPool = mysql.createPool(MYSQL_CONFIG);

  const railway = new PrismaClient({
    datasources: { db: { url: RAILWAY_URL } }
  });

  try {
    // Testar conexões
    console.log('\n🔌 Testando conexões...');
    await mysqlPool.query('SELECT 1');
    console.log('   ✅ MySQL remoto conectado');
    await railway.$queryRaw`SELECT 1`;
    console.log('   ✅ Railway conectado');

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

    // ETAPA 5: Convênios
    const conveniosCount = await migrarConvenios(mysqlPool, railway, defaultUser.id);

    // ETAPA 6: Sócios (MySQL → Railway)
    const sociosResult = await migrarSocios(mysqlPool, railway, defaultUser.id, consigMap);

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

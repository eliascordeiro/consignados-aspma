import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

// Railway PostgreSQL
const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
});

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

interface MatriculaMapping {
  matricula_antiga: number;
  matricula_atual: number;
}

async function migrate() {
  console.log('🚀 MIGRAÇÃO: VENDAS E PARCELAS (MySQL → Railway)\n');
  console.log('='.repeat(70));

  // 1. Conectar ao MySQL
  console.log('\n📊 PASSO 1: Conectando ao MySQL...');
  const mysql_conn = await mysql.createConnection({
    host: '200.98.112.240',
    port: 3306,
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
    charset: 'utf8mb4'
  });
  console.log('   ✅ MySQL conectado');

  // 2. Carregar mapeamento de matrículas
  console.log('\n📊 PASSO 2: Carregando mapeamento de matrículas...');
  const [matriculasRows] = await mysql_conn.query('SELECT * FROM matriculas');
  const matriculaMap = new Map<number, number>();
  (matriculasRows as MatriculaMapping[]).forEach(m => {
    matriculaMap.set(m.matricula_antiga, m.matricula_atual);
  });
  console.log(`   ✅ ${matriculaMap.size} mapeamentos carregados`);

  // 3. Carregar sócios do Railway (para mapear matrícula → socioId)
  console.log('\n📊 PASSO 3: Carregando sócios do Railway...');
  const sociosRailway = await railwayPrisma.socio.findMany({
    select: { id: true, matricula: true }
  });
  const socioByMatricula = new Map<string, string>();
  sociosRailway.forEach(s => {
    socioByMatricula.set(s.matricula.trim(), s.id);
  });
  console.log(`   ✅ ${socioByMatricula.size} sócios mapeados`);

  // 4. Carregar convênios do Railway
  console.log('\n📊 PASSO 4: Carregando convênios do Railway...');
  const conveniosRailway = await railwayPrisma.convenio.findMany({
    select: { id: true, codconven: true }
  });
  const convenioByCodigo = new Map<number, number>();
  conveniosRailway.forEach(c => {
    if (c.codconven !== null) {
      convenioByCodigo.set(c.codconven, c.id);
    }
  });
  console.log(`   ✅ ${convenioByCodigo.size} convênios mapeados`);

  // 5. Buscar usuário admin para criação
  console.log('\n📊 PASSO 5: Buscando usuário admin...');
  const adminUser = await railwayPrisma.users.findFirst({
    where: { email: 'admin@consigexpress.com' },
    select: { id: true }
  });
  if (!adminUser) {
    throw new Error('Usuário admin não encontrado!');
  }
  console.log(`   ✅ Admin encontrado: ${adminUser.id}`);

  // 6. Verificar estado atual do Railway
  console.log('\n📊 PASSO 6: Verificando estado atual do Railway...');
  const vendasAntes = await railwayPrisma.venda.count();
  const parcelasAntes = await railwayPrisma.parcela.count();
  console.log(`   Vendas no Railway: ${vendasAntes}`);
  console.log(`   Parcelas no Railway: ${parcelasAntes}`);

  // 7. Carregar vendas do MySQL
  console.log('\n📊 PASSO 7: Carregando vendas do MySQL...');
  const [vendasMySQL] = await mysql_conn.query('SELECT * FROM vendas ORDER BY id');
  console.log(`   ✅ ${(vendasMySQL as MySQLVenda[]).length} vendas encontradas`);

  // 8. Migrar vendas em batches
  console.log('\n📊 PASSO 8: Migrando vendas...');
  const BATCH_SIZE = 500;
  let vendasMigradas = 0;
  let vendasSemSocio = 0;
  let vendasDuplicadas = 0;
  const vendaIdMap = new Map<string, string>(); // "matricula-sequencia" → vendaId (Railway)

  const vendasArray = vendasMySQL as MySQLVenda[];
  
  for (let i = 0; i < vendasArray.length; i += BATCH_SIZE) {
    const batch = vendasArray.slice(i, i + BATCH_SIZE);
    
    for (const venda of batch) {
      // Aplicar mapeamento de matrícula
      let matriculaAtual = venda.matricula;
      if (matriculaMap.has(venda.matricula)) {
        matriculaAtual = matriculaMap.get(venda.matricula)!;
      }
      
      // Encontrar sócio pela matrícula atualizada
      const socioId = socioByMatricula.get(matriculaAtual.toString());
      if (!socioId) {
        vendasSemSocio++;
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
            observacoes: null,
            quantidadeParcelas: Math.round(venda.parcelas || 1),
            valorParcela: venda.valorparcela || 0,
            valorTotal: (venda.valorparcela || 0) * (venda.parcelas || 1),
            ativo: venda.cancela !== 'S',
            cancelado: venda.cancela === 'S',
            motivoCancelamento: venda.cancela === 'S' ? 'Cancelado no sistema antigo' : null,
            createdById: adminUser.id
          }
        });
        
        // Mapear para as parcelas
        vendaIdMap.set(`${venda.matricula}-${venda.sequencia}`, novaVenda.id);
        vendasMigradas++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          vendasDuplicadas++;
        } else {
          console.error(`   ❌ Erro na venda ${venda.id}:`, err.message);
        }
      }
    }
    
    console.log(`   Progresso: ${Math.min(i + BATCH_SIZE, vendasArray.length)}/${vendasArray.length} (${vendasMigradas} migradas)`);
  }
  
  console.log(`\n   ✅ Vendas migradas: ${vendasMigradas}`);
  console.log(`   ⚠️  Vendas sem sócio: ${vendasSemSocio}`);
  console.log(`   ⚠️  Vendas duplicadas: ${vendasDuplicadas}`);

  // 9. Carregar parcelas do MySQL
  console.log('\n📊 PASSO 9: Carregando parcelas do MySQL...');
  const [parcelasMySQL] = await mysql_conn.query('SELECT * FROM parcelas ORDER BY id');
  console.log(`   ✅ ${(parcelasMySQL as MySQLParcela[]).length} parcelas encontradas`);

  // 10. Migrar parcelas em batches
  console.log('\n📊 PASSO 10: Migrando parcelas...');
  let parcelasMigradas = 0;
  let parcelasSemVenda = 0;
  let parcelasDuplicadas = 0;

  const parcelasArray = parcelasMySQL as MySQLParcela[];
  
  for (let i = 0; i < parcelasArray.length; i += BATCH_SIZE) {
    const batch = parcelasArray.slice(i, i + BATCH_SIZE);
    
    for (const parcela of batch) {
      const matriculaNum = parseInt(parcela.matricula);
      const sequenciaNum = parseInt(parcela.sequencia);
      
      // Encontrar vendaId pelo mapeamento
      const vendaId = vendaIdMap.get(`${matriculaNum}-${sequenciaNum}`);
      if (!vendaId) {
        parcelasSemVenda++;
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
            observacoes: null,
            createdById: adminUser.id
          }
        });
        
        parcelasMigradas++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          parcelasDuplicadas++;
        } else {
          // Silenciar erros individuais para não poluir o log
        }
      }
    }
    
    if ((i + BATCH_SIZE) % 50000 === 0 || i + BATCH_SIZE >= parcelasArray.length) {
      console.log(`   Progresso: ${Math.min(i + BATCH_SIZE, parcelasArray.length)}/${parcelasArray.length} (${parcelasMigradas} migradas)`);
    }
  }
  
  console.log(`\n   ✅ Parcelas migradas: ${parcelasMigradas}`);
  console.log(`   ⚠️  Parcelas sem venda: ${parcelasSemVenda}`);
  console.log(`   ⚠️  Parcelas duplicadas: ${parcelasDuplicadas}`);

  // 11. Verificação final
  console.log('\n📊 PASSO 11: Verificação final...');
  const vendasDepois = await railwayPrisma.venda.count();
  const parcelasDepois = await railwayPrisma.parcela.count();
  
  console.log(`\n   RAILWAY (antes):  ${vendasAntes} vendas | ${parcelasAntes} parcelas`);
  console.log(`   RAILWAY (depois): ${vendasDepois} vendas | ${parcelasDepois} parcelas`);
  console.log(`   MIGRADAS:         +${vendasDepois - vendasAntes} vendas | +${parcelasDepois - parcelasAntes} parcelas`);

  // Fechar conexões
  await mysql_conn.end();
  await railwayPrisma.$disconnect();

  console.log('\n' + '='.repeat(70));
  console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log('='.repeat(70));
}

migrate().catch(console.error);

import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

// URL do PostgreSQL LOCAL
const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/consignados_temp';

// Força usar o banco local
process.env.DATABASE_URL = LOCAL_DATABASE_URL;

const prisma = new PrismaClient();

interface MySQLVenda {
  id: number;
  matricula: string;
  sequencia: number;
  emissao: Date;
  operador: string;
  autorizado: string;
  conveniado: string;
  codconven: number;
  parcelas: number;
  valorparcela: number;
  cancela: string;
}

interface MySQLParcela {
  id: number;
  matricula: string;
  sequencia: number;
  nrseq: number;
  vencimento: Date;
  valor: number;
  baixa: string | null;
  tipo: string | null;
}

const MYSQL_CONFIG = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const BATCH_SIZE = 500; // Maior batch = mais rápido localmente

async function main() {
  console.log('🚀 MIGRAÇÃO RÁPIDA: MySQL → PostgreSQL LOCAL\n');
  console.log(`📍 Destino: ${LOCAL_DATABASE_URL}\n`);
  
  // Debug: verifica modelos disponíveis
  console.log('🔍 Modelos Prisma disponíveis:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
  console.log('');

  let mysqlConnection: mysql.Connection | null = null;

  try {
    // Conecta ao MySQL
    console.log('🔌 Conectando ao MySQL...');
    mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('✅ Conectado ao MySQL\n');

    // Busca ou cria o manager padrão
    let manager = await prisma.users.findFirst({
      where: { email: 'gestao@aspma.com.br' },
    });

    if (!manager) {
      console.log('⚠️  Manager não existe, criando...');
      manager = await prisma.users.create({
        data: {
          name: 'Gestão ASPMA',
          email: 'gestao@aspma.com.br',
          password: 'hashed_password', // senha hasheada
          role: 'ADMIN',
        },
      });
      console.log('✅ Manager criado\n');
    }

    // ========== MAPEAMENTO DE SÓCIOS ==========
    console.log('📋 Carregando sócios do Railway...');
    const socios = await prisma.socio.findMany({
      select: { id: true, matricula: true },
    });
    const socioMap = new Map(socios.map((s) => [s.matricula, s.id]));
    console.log(`✅ ${socioMap.size} sócios carregados\n`);

    // ========== MAPEAMENTO DE CONVÊNIOS ==========
    console.log('📋 Carregando convênios do Railway...');
    const convenios = await prisma.convenio.findMany({
      select: { id: true, codigo: true },
    });
    const convenioMap = new Map(
      convenios.filter((c) => c.codigo).map((c) => [c.codigo!.toString(), c.id])
    );
    console.log(`✅ ${convenioMap.size} convênios carregados\n`);

    // ========== CONTA TOTAL DE VENDAS ==========
    const [vendasCount] = await mysqlConnection.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM vendas'
    );
    const totalVendas = vendasCount[0].total;
    console.log(`📊 Total de vendas no MySQL: ${totalVendas}\n`);

    // ========== MIGRAÇÃO DE VENDAS ==========
    console.log('📦 Migrando vendas em lotes...\n');
    const vendasMap = new Map<string, number>(); // matricula-sequencia → id Railway
    let lastVendaId = 0;
    let totalMigradas = 0;
    let totalPuladas = 0;
    let hasMore = true;

    while (hasMore) {
      const [vendas] = await mysqlConnection.query<mysql.RowDataPacket[]>(
        `SELECT * FROM vendas WHERE id > ${lastVendaId} ORDER BY id LIMIT ${BATCH_SIZE}`
      );

      if (vendas.length === 0) {
        hasMore = false;
        break;
      }

      for (const venda of vendas as MySQLVenda[]) {
        try {
          lastVendaId = venda.id;

          if (!venda.matricula || !venda.sequencia) {
            totalPuladas++;
            continue;
          }

          const matriculaStr = venda.matricula?.toString();
          const socioId = socioMap.get(matriculaStr);
          if (!socioId) {
            totalPuladas++;
            continue;
          }

          let convenioId: number | null = null;
          if (venda.codconven) {
            convenioId = convenioMap.get(venda.codconven.toString()) || null;
          }

          const vendaCriada = await prisma.venda.create({
            data: {
              userId: manager.id,
              socioId,
              convenioId: convenioId,
              numeroVenda: venda.sequencia,
              dataEmissao: venda.emissao || new Date(),
              operador: venda.operador || venda.autorizado || 'Sistema',
              observacoes: venda.conveniado || null,
              quantidadeParcelas: venda.parcelas || 0,
              valorParcela: venda.valorparcela || 0,
              valorTotal: (venda.valorparcela || 0) * (venda.parcelas || 0),
              ativo: venda.cancela !== 'S',
              cancelado: venda.cancela === 'S',
              motivoCancelamento: venda.cancela === 'S' ? 'Cancelado no sistema antigo' : null,
            },
          });

          const mysqlKey = `${venda.matricula}-${venda.sequencia}`;
          vendasMap.set(mysqlKey, vendaCriada.id);
          totalMigradas++;
        } catch (error: any) {
          if (!error.message.includes('Unique constraint')) {
            console.error(`❌ Erro venda ${venda.id}:`, error.message);
          }
          totalPuladas++;
        }
      }

      const progresso = Math.min(((totalMigradas + totalPuladas) / totalVendas) * 100, 100).toFixed(1);
      process.stdout.write(`\r⏳ Vendas: ${progresso}% (${totalMigradas} OK, ${totalPuladas} skip)`);
    }

    console.log(`\n✅ Vendas migradas: ${totalMigradas}\n`);

    // ========== CONTA TOTAL DE PARCELAS ==========
    const [parcelasCount] = await mysqlConnection.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM parcelas'
    );
    const totalParcelas = parcelasCount[0].total;
    console.log(`📊 Total de parcelas no MySQL: ${totalParcelas}\n`);

    // ========== MIGRAÇÃO DE PARCELAS ==========
    console.log('📦 Migrando parcelas em lotes...\n');
    let lastParcelaId = 0;
    let totalParcelasMigradas = 0;
    let totalParcelasPuladas = 0;
    hasMore = true;

    while (hasMore) {
      const [parcelas] = await mysqlConnection.query<mysql.RowDataPacket[]>(
        `SELECT * FROM parcelas WHERE id > ${lastParcelaId} ORDER BY id LIMIT ${BATCH_SIZE * 2}`
      );

      if (parcelas.length === 0) {
        hasMore = false;
        break;
      }

      for (const parcela of parcelas as MySQLParcela[]) {
        try {
          lastParcelaId = parcela.id;

          if (!parcela.matricula || !parcela.sequencia || !parcela.nrseq) {
            totalParcelasPuladas++;
            continue;
          }

          const mysqlKey = `${parcela.matricula}-${parcela.sequencia}`;
          const vendaId = vendasMap.get(mysqlKey);

          if (!vendaId) {
            totalParcelasPuladas++;
            continue;
          }

          await prisma.parcela.create({
            data: {
              vendaId,
              numeroParcela: parcela.nrseq,
              dataVencimento: parcela.vencimento || new Date(),
              valor: parcela.valor || 0,
              baixa: parcela.baixa,
              tipo: parcela.tipo,
            },
          });

          totalParcelasMigradas++;
        } catch (error: any) {
          if (!error.message.includes('Unique constraint')) {
            console.error(`❌ Erro parcela ${parcela.id}:`, error.message);
          }
          totalParcelasPuladas++;
        }
      }

      const progresso = Math.min(((totalParcelasMigradas + totalParcelasPuladas) / totalParcelas) * 100, 100).toFixed(1);
      process.stdout.write(`\r⏳ Parcelas: ${progresso}% (${totalParcelasMigradas} OK, ${totalParcelasPuladas} skip)`);
    }

    console.log(`\n✅ Parcelas migradas: ${totalParcelasMigradas}\n`);

    console.log('\n🎉 MIGRAÇÃO LOCAL COMPLETA!\n');
    console.log('📊 Resumo:');
    console.log(`   Vendas: ${totalMigradas}/${totalVendas}`);
    console.log(`   Parcelas: ${totalParcelasMigradas}/${totalParcelas}`);
    console.log('\n📝 Próximos passos:');
    console.log('   1. Fazer dump: pg_dump consignados_temp > backup.sql');
    console.log('   2. Restaurar no Railway: psql $DATABASE_URL < backup.sql');

  } catch (error) {
    console.error('\n❌ Erro na migração:', error);
    throw error;
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    await prisma.$disconnect();
  }
}

main();

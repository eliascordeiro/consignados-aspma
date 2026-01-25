import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

// URL do PostgreSQL LOCAL
const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/consignados_temp';

process.env.DATABASE_URL = LOCAL_DATABASE_URL;

const prisma = new PrismaClient();

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

const BATCH_SIZE = 1000; // Batch maior para parcelas

async function main() {
  console.log('🚀 MIGRAÇÃO RÁPIDA: Parcelas MySQL → PostgreSQL LOCAL\n');
  console.log(`📍 Destino: ${LOCAL_DATABASE_URL}\n`);

  let mysqlConnection: mysql.Connection | null = null;

  try {
    console.log('🔌 Conectando ao MySQL...');
    mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('✅ Conectado ao MySQL\n');

    // Carrega vendas do PostgreSQL local
    console.log('📋 Carregando vendas do banco local...');
    const vendas = await prisma.venda.findMany({
      select: { id: true, socioId: true, numeroVenda: true },
    });
    
    // Cria mapa matricula-numeroVenda -> vendaId
    const sociosMap = await prisma.socio.findMany({
      select: { id: true, matricula: true },
    });
    const matriculaToSocioId = new Map(sociosMap.map(s => [s.matricula, s.id]));
    
    const vendasMap = new Map<string, string>();
    for (const venda of vendas) {
      const socio = sociosMap.find(s => s.id === venda.socioId);
      if (socio) {
        const matriculaTrim = socio.matricula.trim();
        const numeroVendaTrim = venda.numeroVenda.toString().trim();
        
        // Cria múltiplas variações de chave para lidar com espaços
        const keys = [
          `${socio.matricula}-${venda.numeroVenda}`,
          `${matriculaTrim}-${venda.numeroVenda}`,
          `${socio.matricula}-${numeroVendaTrim}`,
          `${matriculaTrim}-${numeroVendaTrim}`,
        ];
        
        keys.forEach(key => vendasMap.set(key, venda.id));
      }
    }
    
    console.log(`✅ ${vendasMap.size} vendas mapeadas\n`);

    // Conta parcelas
    const [parcelasCount] = await mysqlConnection.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM parcelas'
    );
    const totalParcelas = parcelasCount[0].total;
    console.log(`📊 Total de parcelas no MySQL: ${totalParcelas}\n`);

    // Migra parcelas
    console.log('📦 Migrando parcelas em lotes...\n');
    let lastParcelaId = 0;
    let totalMigradas = 0;
    let totalPuladas = 0;
    let hasMore = true;

    while (hasMore) {
      let parcelas: mysql.RowDataPacket[] = [];
      
      // Retry com reconexão em caso de timeout
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await mysqlConnection.query<mysql.RowDataPacket[]>(
            `SELECT * FROM parcelas WHERE id > ${lastParcelaId} ORDER BY id LIMIT ${BATCH_SIZE}`
          );
          parcelas = result[0];
          break;
        } catch (error: any) {
          if (error.code === 'ETIMEDOUT' && attempt < 2) {
            console.log(`\n⚠️  Timeout MySQL, reconectando (tentativa ${attempt + 2}/3)...`);
            await mysqlConnection.end();
            mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw error;
          }
        }
      }

      if (parcelas.length === 0) {
        hasMore = false;
        break;
      }

      for (const parcela of parcelas as MySQLParcela[]) {
        try {
          lastParcelaId = parcela.id;

          // Valida campos
          if (!parcela.matricula || !parcela.sequencia || !parcela.nrseq) {
            totalPuladas++;
            continue;
          }

          // Busca venda - tenta com e sem trim
          const matriculaTrim = parcela.matricula.toString().trim();
          const sequenciaTrim = parcela.sequencia.toString().trim();
          
          let vendaId = vendasMap.get(`${parcela.matricula}-${parcela.sequencia}`)
            || vendasMap.get(`${matriculaTrim}-${parcela.sequencia}`)
            || vendasMap.get(`${parcela.matricula}-${sequenciaTrim}`)
            || vendasMap.get(`${matriculaTrim}-${sequenciaTrim}`);

          if (!vendaId) {
            totalPuladas++;
            continue;
          }

          // Cria parcela
          await prisma.parcela.create({
            data: {
              vendaId,
              numeroParcela: parseInt(parcela.nrseq.toString()),
              dataVencimento: parcela.vencimento || new Date(),
              valor: parcela.valor || 0,
              baixa: parcela.baixa,
              tipo: parcela.tipo,
            },
          });

          totalMigradas++;
        } catch (error: any) {
          if (!error.message.includes('Unique constraint')) {
            console.error(`\n❌ Erro parcela ${parcela.id}:`, error.message);
          }
          totalPuladas++;
        }
      }

      const progresso = Math.min(((totalMigradas + totalPuladas) / totalParcelas) * 100, 100).toFixed(1);
      process.stdout.write(`\r⏳ Progresso: ${progresso}% (${totalMigradas} OK, ${totalPuladas} skip)`);
    }

    console.log(`\n\n✅ Parcelas migradas: ${totalMigradas}/${totalParcelas}\n`);

    console.log('🎉 MIGRAÇÃO DE PARCELAS COMPLETA!\n');
    console.log('📝 Próximo passo: fazer dump e restaurar no Railway');

  } catch (error) {
    console.error('\n❌ Erro:', error);
    throw error;
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    await prisma.$disconnect();
  }
}

main();

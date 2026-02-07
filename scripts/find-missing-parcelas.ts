import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

const mysqlConfig = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma'
};

const railwayPrisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }
  }
});

async function findMissingParcelas() {
  console.log('🔍 Analisando parcelas não migradas...\n');

  const mysqlConn = await mysql.createConnection(mysqlConfig);

  try {
    // 1. Estatísticas gerais
    const [[mysqlCount]] = await mysqlConn.query('SELECT COUNT(*) as total FROM parcelas') as any;
    const railwayCount = await railwayPrisma.parcela.count();

    console.log(`📊 MySQL:   ${mysqlCount.total.toLocaleString('pt-BR')} parcelas`);
    console.log(`📊 Railway: ${railwayCount.toLocaleString('pt-BR')} parcelas`);
    console.log(`❌ Faltando: ${(mysqlCount.total - railwayCount).toLocaleString('pt-BR')} parcelas\n`);

    // 2. Analisar gaps nos IDs
    console.log('📊 Analisando distribuição de IDs...');
    const [[range]] = await mysqlConn.query('SELECT MIN(id) as minId, MAX(id) as maxId FROM parcelas') as any;
    console.log(`   Range: ${range.minId} - ${range.maxId}`);
    console.log(`   Possíveis IDs: ${(range.maxId - range.minId + 1).toLocaleString('pt-BR')}`);
    console.log(`   IDs com gaps: ${(range.maxId - range.minId + 1 - mysqlCount.total).toLocaleString('pt-BR')}\n`);

    // 3. Encontrar ranges de IDs sem parcelas no Railway
    console.log('🔍 Identificando ranges problemáticos (IDs com parcelas não migradas)...\n');

    // Dividir em ranges de 50k IDs e verificar cada um
    const rangeSize = 50000;
    const ranges: Array<{start: number, end: number, mysqlCount: number, railwayCount: number}> = [];

    for (let start = range.minId; start <= range.maxId; start += rangeSize) {
      const end = Math.min(start + rangeSize - 1, range.maxId);

      // Contar no MySQL
      const [[mysqlRangeCount]] = await mysqlConn.query(
        'SELECT COUNT(*) as total FROM parcelas WHERE id >= ? AND id <= ?',
        [start, end]
      ) as any;

      if (mysqlRangeCount.total > 0) {
        // Contar no Railway usando query raw (mais rápido)
        const railwayRangeCount = await railwayPrisma.$queryRaw<any[]>`
          SELECT COUNT(*) as total 
          FROM parcelas p
          INNER JOIN vendas v ON v.id = p."vendaId"
          WHERE EXISTS (
            SELECT 1 FROM unnest(ARRAY[${start}::integer, ${end}::integer]) AS range_id
          )
        `;

        // Simplificar: apenas buscar total de parcelas criadas após a migração começar
        const approxRailwayCount = await railwayPrisma.parcela.count({
          where: {
            createdAt: {
              gte: new Date('2026-02-05')
            }
          },
          take: mysqlRangeCount.total
        });

        const diff = mysqlRangeCount.total - (railwayRangeCount[0]?.total || 0);

        if (diff > 100) {
          ranges.push({
            start,
            end,
            mysqlCount: mysqlRangeCount.total,
            railwayCount: railwayRangeCount[0]?.total || 0
          });
          console.log(`   ⚠️  Range ${start}-${end}: MySQL=${mysqlRangeCount.total}, Railway≈${railwayRangeCount[0]?.total || 0}, Diff≈${diff}`);
        }
      }
    }

    console.log(`\n✅ Encontrados ${ranges.length} ranges com possíveis parcelas faltantes\n`);

    // 4. Amostrar parcelas específicas não migradas
    console.log('📋 Amostra de parcelas não migradas (verificação por venda):');

    // Pegar amostra aleatória de parcelas do MySQL
    const [sampleParcelas] = await mysqlConn.query(`
      SELECT id, matricula, sequencia, nrseq, vencimento, valor 
      FROM parcelas 
      ORDER BY RAND() 
      LIMIT 100
    `) as any;

    let checked = 0;
    let missing = 0;

    for (const parcela of sampleParcelas) {
      // Buscar venda correspondente
      const venda = await railwayPrisma.venda.findFirst({
        where: {
          numeroVenda: parseInt(parcela.sequencia),
          socio: {
            matricula: parcela.matricula.toString()
          }
        },
        include: {
          parcelas: {
            where: {
              numeroParcela: parseInt(parcela.nrseq)
            }
          }
        }
      });

      checked++;

      if (venda && venda.parcelas.length === 0) {
        missing++;
        if (missing <= 10) {
          console.log(`   ❌ MySQL ID ${parcela.id}: Venda ${venda.id} existe, mas parcela ${parcela.nrseq} está faltando`);
        }
      } else if (!venda) {
        if (missing <= 10) {
          console.log(`   ⚠️  MySQL ID ${parcela.id}: Venda não encontrada (matrícula=${parcela.matricula}, seq=${parcela.sequencia})`);
        }
        missing++;
      }
    }

    console.log(`\n📊 Amostra: ${checked} parcelas checadas, ${missing} não encontradas (${((missing/checked)*100).toFixed(1)}%)`);

    // 5. Sugestão
    console.log('\n💡 Sugestões:');
    console.log('   1. Executar migração complementar para ranges problemáticos');
    console.log('   2. Verificar se vendas relacionadas foram migradas');
    console.log('   3. Verificar mapeamento de matrículas\n');

  } finally {
    await mysqlConn.end();
    await railwayPrisma.$disconnect();
  }
}

findMissingParcelas().catch(console.error);

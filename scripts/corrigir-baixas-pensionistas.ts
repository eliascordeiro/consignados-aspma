import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '200.98.112.240',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

async function corrigirBaixas() {
  console.log('\n🔧 CORREÇÃO: Campo baixa nas parcelas de pensionistas\n');

  const mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // 1. Buscar parcelas do MySQL que estão em aberto (baixa = '')
    const [mysqlRows] = await mysqlConnection.execute(`
      SELECT 
        p.matricula,
        p.sequencia,
        p.nrseq,
        p.valor,
        p.vencimento,
        p.baixa,
        s.codtipo
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026
        AND MONTH(p.vencimento) = 2
        AND TRIM(p.baixa) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
      LIMIT 10
    `);

    console.log(`📊 Amostra de parcelas EM ABERTO no MySQL (primeiras 10):\n`);
    
    for (const row of mysqlRows as any[]) {
      console.log(`   Mat: ${row.matricula.trim()} | Seq: ${row.sequencia} | Parcela: ${row.nrseq} | Valor: R$ ${row.valor}`);
      console.log(`      Vencimento: ${new Date(row.vencimento).toLocaleDateString('pt-BR')} | Baixa MySQL: "${row.baixa}"`);
      
      // Buscar correspondente no PostgreSQL
      const pgParcela = await prisma.parcela.findFirst({
        where: {
          dataVencimento: new Date(row.vencimento),
          numeroParcela: parseInt(row.nrseq),
          venda: {
            numeroVenda: row.sequencia,
            socio: {
              matricula: row.matricula.trim()
            }
          }
        },
        select: {
          id: true,
          baixa: true,
          valor: true,
        }
      });

      if (pgParcela) {
        console.log(`      PostgreSQL: ID=${pgParcela.id} | baixa="${pgParcela.baixa}" | Valor: R$ ${pgParcela.valor}`);
        
        if (pgParcela.baixa === 'S') {
          console.log(`      ⚠️  DIVERGÊNCIA: PostgreSQL tem 'S' mas MySQL tem ''`);
        }
      } else {
        console.log(`      ❌ NÃO ENCONTRADO no PostgreSQL`);
      }
      console.log('');
    }

    // 2. Contar quantas parcelas precisam de correção
    console.log('\n📊 ANÁLISE COMPLETA:\n');
    
    const [countRows] = await mysqlConnection.execute(`
      SELECT COUNT(*) as total, SUM(p.valor) as total_valor
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026
        AND MONTH(p.vencimento) = 2
        AND TRIM(p.baixa) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
    `);

    const mysqlTotal = (countRows as any[])[0];
    console.log(`   MySQL (em aberto): ${mysqlTotal.total} parcelas | Total: R$ ${Number(mysqlTotal.total_valor).toFixed(2)}`);

    // PostgreSQL com baixa = 'S' (incorretas)
    const dataInicio = new Date(2026, 1, 1);
    const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999);

    const pgComS = await prisma.parcela.count({
      where: {
        dataVencimento: { gte: dataInicio, lte: dataFim },
        baixa: 'S',
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
      }
    });

    console.log(`   PostgreSQL (baixa='S'): ${pgComS} parcelas\n`);

    console.log('💡 SUGESTÃO DE CORREÇÃO:\n');
    console.log('   Para alinhar com o MySQL, execute:\n');
    console.log(`   UPDATE "Parcela" SET baixa = 'N'`);
    console.log(`   WHERE "dataVencimento" >= '2026-02-01'`);
    console.log(`     AND "dataVencimento" < '2026-03-01'`);
    console.log(`     AND baixa = 'S'`);
    console.log(`     AND "vendaId" IN (`);
    console.log(`       SELECT id FROM "Venda" WHERE "socioId" IN (`);
    console.log(`         SELECT id FROM "Socio" WHERE "codTipo" IN (3, 4)`);
    console.log(`       )`);
    console.log(`     );\n`);

  } finally {
    await mysqlConnection.end();
    await prisma.$disconnect();
  }
}

corrigirBaixas()
  .then(() => {
    console.log('✅ Análise concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

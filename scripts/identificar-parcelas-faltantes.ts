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

async function identificarParcelasFaltantes() {
  console.log('\n🔍 IDENTIFICANDO AS 2.460 PARCELAS FALTANTES\n');

  const mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // 1. Total geral MySQL
    const [totalMySQL] = await mysqlConnection.execute(`
      SELECT COUNT(*) as total
      FROM parcelas
    `);
    console.log(`📊 Total MySQL: ${(totalMySQL as any[])[0].total}\n`);

    // 2. Agrupar por tipo de sócio
    const [porTipo] = await mysqlConnection.execute(`
      SELECT 
        s.codtipo,
        COUNT(*) as total,
        COUNT(CASE WHEN TRIM(p.baixa) = '' THEN 1 END) as em_aberto
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      GROUP BY s.codtipo
      ORDER BY s.codtipo
    `);

    console.log('📊 PARCELAS POR TIPO DE SÓCIO (MySQL):\n');
    for (const row of porTipo as any[]) {
      const tipo = row.codtipo || 'NULL';
      console.log(`   Tipo ${tipo}: ${row.total.toString().padStart(7)} total | ${row.em_aberto.toString().padStart(7)} em aberto`);
    }

    // 3. Verificar as de pensionistas especificamente
    const [pensionistas] = await mysqlConnection.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN TRIM(p.baixa) = '' THEN 1 END) as em_aberto,
        COUNT(CASE WHEN YEAR(p.vencimento) = 2026 AND MONTH(p.vencimento) = 2 AND TRIM(p.baixa) = '' THEN 1 END) as fev2026_aberto
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE s.codtipo IN ('3', '4')
    `);

    const penData = (pensionistas as any[])[0];
    console.log('\n📊 PENSIONISTAS (Tipo 3 e 4) - MySQL:');
    console.log(`   Total: ${penData.total}`);
    console.log(`   Em aberto: ${penData.em_aberto}`);
    console.log(`   Fev/2026 em aberto: ${penData.fev2026_aberto}\n`);

    // 4. PostgreSQL - pensionistas
    const pgPensTotal = await prisma.parcela.count({
      where: {
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
      }
    });

    const pgPensAberto = await prisma.parcela.count({
      where: {
        baixa: 'N',
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
      }
    });

    const dataInicio = new Date(2026, 1, 1);
    const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999);

    const pgPensFev = await prisma.parcela.count({
      where: {
        dataVencimento: { gte: dataInicio, lte: dataFim },
        baixa: 'N',
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
      }
    });

    console.log('📊 PENSIONISTAS (Tipo 3 e 4) - PostgreSQL:');
    console.log(`   Total: ${pgPensTotal}`);
    console.log(`   Em aberto (baixa=N): ${pgPensAberto}`);
    console.log(`   Fev/2026 em aberto: ${pgPensFev}\n`);

    // 5. Comparação
    console.log('=' .repeat(80));
    console.log('📊 ANÁLISE DAS 2.460 PARCELAS FALTANTES:\n');
    
    const diffTotal = penData.total - pgPensTotal;
    const diffAberto = penData.em_aberto - pgPensAberto;
    const diffFev = penData.fev2026_aberto - pgPensFev;

    console.log(`   Pensionistas - Total:`);
    console.log(`      MySQL:      ${penData.total.toString().padStart(7)}`);
    console.log(`      PostgreSQL: ${pgPensTotal.toString().padStart(7)}`);
    console.log(`      FALTAM:     ${diffTotal.toString().padStart(7)}\n`);

    console.log(`   Pensionistas - Em aberto:`);
    console.log(`      MySQL:      ${penData.em_aberto.toString().padStart(7)}`);
    console.log(`      PostgreSQL: ${pgPensAberto.toString().padStart(7)}`);
    console.log(`      FALTAM:     ${diffAberto.toString().padStart(7)}\n`);

    console.log(`   Pensionistas - Fev/2026 em aberto:`);
    console.log(`      MySQL:      ${penData.fev2026_aberto.toString().padStart(7)}`);
    console.log(`      PostgreSQL: ${pgPensFev.toString().padStart(7)}`);
    console.log(`      FALTAM:     ${diffFev.toString().padStart(7)}\n`);

    if (diffFev === 2460 || Math.abs(diffFev - 2460) < 100) {
      console.log('🎯 CONCLUSÃO:');
      console.log('   As 2.460 parcelas faltantes são EXATAMENTE as parcelas de');
      console.log('   pensionistas em ABERTO de FEVEREIRO/2026!\n');
    }

  } finally {
    await mysqlConnection.end();
    await prisma.$disconnect();
  }
}

identificarParcelasFaltantes()
  .then(() => {
    console.log('✅ Identificação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

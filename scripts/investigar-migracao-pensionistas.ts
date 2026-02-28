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

async function investigarMigracao() {
  console.log('\n🔍 INVESTIGAÇÃO: Parcelas de pensionistas - Migração Completa\n');

  const mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // MySQL: Total de parcelas de pensionistas (TODAS, não só fev/2026)
    const [mysqlTotal] = await mysqlConnection.execute(`
      SELECT COUNT(*) as total, SUM(p.valor) as total_valor
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE (s.codtipo = '3' OR s.codtipo = '4')
    `);

    const mysqlData = (mysqlTotal as any[])[0];
    console.log(`📊 MySQL - Total de parcelas de pensionistas (TODAS):`);
    console.log(`   Parcelas: ${mysqlData.total}`);
    console.log(`   Valor: R$ ${Number(mysqlData.total_valor).toFixed(2)}\n`);

    // MySQL: Parcelas EM ABERTO
    const [mysqlAberto] = await mysqlConnection.execute(`
      SELECT COUNT(*) as total, SUM(p.valor) as total_valor
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE (s.codtipo = '3' OR s.codtipo = '4')
        AND TRIM(p.baixa) = ''
    `);

    const mysqlAbertoData = (mysqlAberto as any[])[0];
    console.log(`📊 MySQL - Parcelas em ABERTO:`);
    console.log(`   Parcelas: ${mysqlAbertoData.total}`);
    console.log(`   Valor: R$ ${Number(mysqlAbertoData.total_valor).toFixed(2)}\n`);

    // MySQL: Parcelas de fev/2026 em aberto
    const [mysqlFev] = await mysqlConnection.execute(`
      SELECT COUNT(*) as total, SUM(p.valor) as total_valor
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026
        AND MONTH(p.vencimento) = 2
        AND TRIM(p.baixa) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
    `);

    const mysqlFevData = (mysqlFev as any[])[0];
    console.log(`📊 MySQL - Parcelas fev/2026 em ABERTO:`);
    console.log(`   Parcelas: ${mysqlFevData.total}`);
    console.log(`   Valor: R$ ${Number(mysqlFevData.total_valor).toFixed(2)}\n`);
    console.log('='.repeat(80) + '\n');

    // PostgreSQL: Total de parcelas de pensionistas
    const pgTotal = await prisma.parcela.count({
      where: {
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
      }
    });

    console.log(`📊 PostgreSQL - Total de parcelas de pensionistas (TODAS):`);
    console.log(`   Parcelas: ${pgTotal}\n`);

    // PostgreSQL: Parcelas em aberto ('N')
    const pgAberto = await prisma.parcela.count({
      where: {
        baixa: 'N',
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
      }
    });

    console.log(`📊 PostgreSQL - Parcelas em ABERTO (baixa='N'):`);
    console.log(`   Parcelas: ${pgAberto}\n`);

    // PostgreSQL: Parcelas de fev/2026 em aberto
    const dataInicio = new Date(2026, 1, 1);
    const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999);

    const pgFev = await prisma.parcela.count({
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

    const parcelasFev = await prisma.parcela.findMany({
      where: {
        dataVencimento: { gte: dataInicio, lte: dataFim },
        baixa: 'N',
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
      },
      select: {
        valor: true
      }
    });

    const pgFevValor = parcelasFev.reduce((sum, p) => sum + Number(p.valor), 0);

    console.log(`📊 PostgreSQL - Parcelas fev/2026 em ABERTO:`);
    console.log(`   Parcelas: ${pgFev}`);
    console.log(`   Valor: R$ ${pgFevValor.toFixed(2)}\n`);
    console.log('='.repeat(80) + '\n');

    // Comparação
    console.log(`📊 COMPARAÇÃO GERAL:\n`);
    console.log(`   Total (todas):`);
    console.log(`      MySQL:      ${mysqlData.total} parcelas`);
    console.log(`      PostgreSQL: ${pgTotal} parcelas`);
    console.log(`      Diferença:  ${mysqlData.total - pgTotal} parcelas FALTANDO\n`);

    console.log(`   Em aberto:`);
    console.log(`      MySQL:      ${mysqlAbertoData.total} parcelas | R$ ${Number(mysqlAbertoData.total_valor).toFixed(2)}`);
    console.log(`      PostgreSQL: ${pgAberto} parcelas`);
    console.log(`      Diferença:  ${mysqlAbertoData.total - pgAberto} parcelas FALTANDO\n`);

    console.log(`   Fev/2026 em aberto:`);
    console.log(`      MySQL:      ${mysqlFevData.total} parcelas | R$ ${Number(mysqlFevData.total_valor).toFixed(2)}`);
    console.log(`      PostgreSQL: ${pgFev} parcelas | R$ ${pgFevValor.toFixed(2)}`);
    console.log(`      Diferença:  ${mysqlFevData.total - pgFev} parcelas | R$ ${(Number(mysqlFevData.total_valor) - pgFevValor).toFixed(2)}\n`);

  } finally {
    await mysqlConnection.end();
    await prisma.$disconnect();
  }
}

investigarMigracao()
  .then(() => {
    console.log('✅ Investigação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

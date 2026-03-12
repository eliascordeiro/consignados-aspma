/**
 * Calcula a diferença exata entre MySQL e PostgreSQL para pensionistas
 */

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

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DIFERENÇA EXATA: MySQL vs PostgreSQL');
  console.log('  Pensionistas - Março/2026');
  console.log('═══════════════════════════════════════════════════════════\n');

  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // ══════════════════════════════════════════════════════════════════
    // MYSQL - Query igual ao AS302.PRG linha 113
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 MYSQL (AS302.PRG linha 113):\n');

    const [parcelasMySQL] = await mysqlConn.execute(`
      SELECT 
        parcelas.*,
        socios.codtipo 
      FROM parcelas 
      LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) 
      WHERE MONTH(parcelas.vencimento) = 3 
        AND YEAR(parcelas.vencimento) = 2026 
        AND TRIM(parcelas.baixa) = '' 
        AND (socios.codtipo = '3' OR socios.codtipo = '4') 
      ORDER BY parcelas.associado, parcelas.matricula, parcelas.sequencia, parcelas.nrseq
    `);

    const totalMySQL = (parcelasMySQL as any[]).reduce(
      (sum, p) => sum + parseFloat(p.valor || 0),
      0
    );

    console.log(`   Total parcelas: ${(parcelasMySQL as any[]).length}`);
    console.log(`   Valor total: R$ ${totalMySQL.toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // POSTGRESQL - Query atual do sistema
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 POSTGRESQL (Railway):\n');

    const parcelasPG = await prisma.parcela.findMany({
      where: {
        baixa: '',
        dataVencimento: {
          gte: new Date('2026-03-01'),
          lt: new Date('2026-04-01'),
        },
        venda: {
          socio: {
            codTipo: {
              in: [3, 4],
            },
          },
        },
      },
      include: {
        venda: {
          include: {
            socio: true,
          },
        },
      },
    });

    const totalPG = parcelasPG.reduce(
      (sum, p) => sum + parseFloat(p.valor.toString() || '0'),
      0
    );

    console.log(`   Total parcelas: ${parcelasPG.length}`);
    console.log(`   Valor total: R$ ${totalPG.toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // DIFERENÇA
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  DIFERENÇA');
    console.log('═══════════════════════════════════════════════════════════\n');

    const diferencaParcelas = (parcelasMySQL as any[]).length - parcelasPG.length;
    const diferencaValor = totalMySQL - totalPG;

    console.log(`   Parcelas:`);
    console.log(`      MySQL:      ${(parcelasMySQL as any[]).length}`);
    console.log(`      PostgreSQL: ${parcelasPG.length}`);
    console.log(`      Diferença:  ${diferencaParcelas} (${((diferencaParcelas / (parcelasMySQL as any[]).length) * 100).toFixed(1)}%)\n`);

    console.log(`   Valores:`);
    console.log(`      MySQL:      R$ ${totalMySQL.toFixed(2)}`);
    console.log(`      PostgreSQL: R$ ${totalPG.toFixed(2)}`);
    console.log(`      Diferença:  R$ ${Math.abs(diferencaValor).toFixed(2)}\n`);

    // Verificar se a diferença é 637.78
    if (Math.abs(diferencaValor) === 637.78) {
      console.log(`   ✅ A diferença é exatamente R$ 637,78!\n`);
    } else if (Math.abs(diferencaValor) === 1174.71) {
      console.log(`   ⚠️  A diferença é R$ 1.174,71 (não 637,78)\n`);
    } else {
      console.log(`   ℹ️  A diferença é R$ ${Math.abs(diferencaValor).toFixed(2)}\n`);
    }

    // ══════════════════════════════════════════════════════════════════
    // DETALHAMENTO
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ANÁLISE DETALHADA');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Distribuição por codtipo
    const mysqlPorTipo = (parcelasMySQL as any[]).reduce((acc: any, p) => {
      const tipo = p.codtipo || 'null';
      if (!acc[tipo]) acc[tipo] = { qtd: 0, valor: 0 };
      acc[tipo].qtd++;
      acc[tipo].valor += parseFloat(p.valor || 0);
      return acc;
    }, {});

    const pgPorTipo = parcelasPG.reduce((acc: any, p) => {
      const tipo = p.venda.socio.codTipo || 'null';
      if (!acc[tipo]) acc[tipo] = { qtd: 0, valor: 0 };
      acc[tipo].qtd++;
      acc[tipo].valor += parseFloat(p.valor.toString() || '0');
      return acc;
    }, {});

    console.log('📊 Distribuição por Tipo de Sócio:\n');

    console.log('   MySQL:');
    Object.entries(mysqlPorTipo).forEach(([tipo, dados]: [string, any]) => {
      console.log(`      Tipo ${tipo}: ${dados.qtd} parcelas, R$ ${dados.valor.toFixed(2)}`);
    });

    console.log('\n   PostgreSQL:');
    Object.entries(pgPorTipo).forEach(([tipo, dados]: [string, any]) => {
      console.log(`      Tipo ${tipo}: ${dados.qtd} parcelas, R$ ${dados.valor.toFixed(2)}`);
    });

  } finally {
    await mysqlConn.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✓ Análise concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    console.error(error);
    process.exit(1);
  });

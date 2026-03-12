/**
 * VERIFICAÇÃO: Total Geral vs Pensionistas
 * 
 * O relatório de comparação mostra R$ 1.210.956,58 em ambos os lados
 * Mas a análise de pensionistas mostra apenas R$ 74.180,60 no PostgreSQL
 * 
 * Este script vai verificar:
 * 1. Total geral de março/2026 (todas as parcelas)
 * 2. Total de pensionistas (codTipo 3 e 4)
 * 3. Total de outros tipos de sócio
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
  console.log('  VERIFICAÇÃO: TOTAL GERAL vs PENSIONISTAS');
  console.log('  Período: Março/2026');
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // ══════════════════════════════════════════════════════════════════
    // 1. MYSQL - TOTAL GERAL (todas as parcelas)
    // ══════════════════════════════════════════════════════════════════
    console.log('📊 1. MySQL - TOTAL GERAL\n');

    const [totalGeralMySQL] = await conn.execute(`
      SELECT 
        COUNT(*) as qtd_parcelas,
        SUM(valor) as valor_total
      FROM parcelas
      WHERE YEAR(vencimento) = 2026 
        AND MONTH(vencimento) = 3
        AND (TRIM(baixa) = '' OR baixa IS NULL)
    `);

    const totalMySQLGeral = (totalGeralMySQL as any[])[0];
    console.log(`   Qtd Parcelas: ${totalMySQLGeral.qtd_parcelas}`);
    console.log(`   Valor Total:  R$ ${parseFloat(totalMySQLGeral.valor_total).toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 2. MYSQL - PENSIONISTAS
    // ══════════════════════════════════════════════════════════════════
    console.log('📊 2. MySQL - PENSIONISTAS (codTipo 3 e 4)\n');

    const [pensionistasMySQL] = await conn.execute(`
      SELECT 
        COUNT(*) as qtd_parcelas,
        SUM(p.valor) as valor_total
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026 
        AND MONTH(p.vencimento) = 3
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
        AND (s.codtipo = '3' OR s.codtipo = '4')
    `);

    const totalMySQLPensionistas = (pensionistasMySQL as any[])[0];
    console.log(`   Qtd Parcelas: ${totalMySQLPensionistas.qtd_parcelas}`);
    console.log(`   Valor Total:  R$ ${parseFloat(totalMySQLPensionistas.valor_total).toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 3. MYSQL - OUTROS TIPOS
    // ══════════════════════════════════════════════════════════════════
    console.log('📊 3. MySQL - OUTROS TIPOS (codTipo 1, 2, 5, etc)\n');

    const [outrosMySQL] = await conn.execute(`
      SELECT 
        COUNT(*) as qtd_parcelas,
        SUM(p.valor) as valor_total
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026 
        AND MONTH(p.vencimento) = 3
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
        AND (s.codtipo != '3' AND s.codtipo != '4' OR s.codtipo IS NULL)
    `);

    const totalMySQLOutros = (outrosMySQL as any[])[0];
    console.log(`   Qtd Parcelas: ${totalMySQLOutros.qtd_parcelas}`);
    console.log(`   Valor Total:  R$ ${parseFloat(totalMySQLOutros.valor_total || 0).toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 4. POSTGRESQL - TOTAL GERAL
    // ══════════════════════════════════════════════════════════════════
    console.log('📊 4. PostgreSQL - TOTAL GERAL\n');

    const dataInicio = new Date(2026, 2, 1, 0, 0, 0);
    const dataFim = new Date(2026, 3, 0, 23, 59, 59);

    const totalGeralPG = await prisma.parcela.aggregate({
      where: {
        dataVencimento: {
          gte: dataInicio,
          lte: dataFim,
        },
        OR: [
          { baixa: null },
          { baixa: '' },
          { baixa: 'N' },
        ],
      },
      _count: true,
      _sum: {
        valor: true,
      },
    });

    console.log(`   Qtd Parcelas: ${totalGeralPG._count}`);
    console.log(`   Valor Total:  R$ ${parseFloat(String(totalGeralPG._sum.valor || 0)).toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 5. POSTGRESQL - PENSIONISTAS
    // ══════════════════════════════════════════════════════════════════
    console.log('📊 5. PostgreSQL - PENSIONISTAS (codTipo 3 e 4)\n');

    const pensionistasPG = await prisma.parcela.aggregate({
      where: {
        dataVencimento: {
          gte: dataInicio,
          lte: dataFim,
        },
        OR: [
          { baixa: null },
          { baixa: '' },
          { baixa: 'N' },
        ],
        venda: {
          socio: {
            codTipo: { in: [3, 4] },
          },
        },
      },
      _count: true,
      _sum: {
        valor: true,
      },
    });

    console.log(`   Qtd Parcelas: ${pensionistasPG._count}`);
    console.log(`   Valor Total:  R$ ${parseFloat(String(pensionistasPG._sum.valor || 0)).toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 6. POSTGRESQL - OUTROS TIPOS
    // ══════════════════════════════════════════════════════════════════
    console.log('📊 6. PostgreSQL - OUTROS TIPOS (codTipo 1, 2, 5, etc)\n');

    const outrosPG = await prisma.parcela.aggregate({
      where: {
        dataVencimento: {
          gte: dataInicio,
          lte: dataFim,
        },
        OR: [
          { baixa: null },
          { baixa: '' },
          { baixa: 'N' },
        ],
        venda: {
          socio: {
            codTipo: { notIn: [3, 4] },
          },
        },
      },
      _count: true,
      _sum: {
        valor: true,
      },
    });

    console.log(`   Qtd Parcelas: ${outrosPG._count}`);
    console.log(`   Valor Total:  R$ ${parseFloat(String(outrosPG._sum.valor || 0)).toFixed(2)}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 7. COMPARAÇÃO FINAL
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  COMPARAÇÃO FINAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ TOTAL GERAL (todas as parcelas em aberto)                   │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    console.log(`│ MySQL:      ${String(totalMySQLGeral.qtd_parcelas).padStart(5)} parcelas - R$ ${parseFloat(totalMySQLGeral.valor_total).toFixed(2).padStart(12)}  │`);
    console.log(`│ PostgreSQL: ${String(totalGeralPG._count).padStart(5)} parcelas - R$ ${parseFloat(String(totalGeralPG._sum.valor || 0)).toFixed(2).padStart(12)}  │`);
    const difGeral = totalMySQLGeral.qtd_parcelas - totalGeralPG._count;
    const difValorGeral = parseFloat(totalMySQLGeral.valor_total) - parseFloat(String(totalGeralPG._sum.valor || 0));
    console.log(`│ Diferença:  ${String(difGeral).padStart(5)} parcelas - R$ ${difValorGeral.toFixed(2).padStart(12)}  │`);
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ PENSIONISTAS (codTipo 3 e 4)                                 │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    console.log(`│ MySQL:      ${String(totalMySQLPensionistas.qtd_parcelas).padStart(5)} parcelas - R$ ${parseFloat(totalMySQLPensionistas.valor_total).toFixed(2).padStart(12)}  │`);
    console.log(`│ PostgreSQL: ${String(pensionistasPG._count).padStart(5)} parcelas - R$ ${parseFloat(String(pensionistasPG._sum.valor || 0)).toFixed(2).padStart(12)}  │`);
    const difPens = totalMySQLPensionistas.qtd_parcelas - pensionistasPG._count;
    const difValorPens = parseFloat(totalMySQLPensionistas.valor_total) - parseFloat(String(pensionistasPG._sum.valor || 0));
    console.log(`│ Diferença:  ${String(difPens).padStart(5)} parcelas - R$ ${difValorPens.toFixed(2).padStart(12)}  │`);
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ OUTROS TIPOS (codTipo 1, 2, 5, etc)                          │');
    console.log('├──────────────────────────────────────────────────────────────┤');
    console.log(`│ MySQL:      ${String(totalMySQLOutros.qtd_parcelas).padStart(5)} parcelas - R$ ${parseFloat(totalMySQLOutros.valor_total || 0).toFixed(2).padStart(12)}  │`);
    console.log(`│ PostgreSQL: ${String(outrosPG._count).padStart(5)} parcelas - R$ ${parseFloat(String(outrosPG._sum.valor || 0)).toFixed(2).padStart(12)}  │`);
    const difOutros = totalMySQLOutros.qtd_parcelas - outrosPG._count;
    const difValorOutros = parseFloat(totalMySQLOutros.valor_total || 0) - parseFloat(String(outrosPG._sum.valor || 0));
    console.log(`│ Diferença:  ${String(difOutros).padStart(5)} parcelas - R$ ${difValorOutros.toFixed(2).padStart(12)}  │`);
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // ══════════════════════════════════════════════════════════════════
    // 8. ANÁLISE
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ANÁLISE');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (Math.abs(difValorGeral) < 1) {
      console.log('✅ TOTAL GERAL está correto! Diferença < R$ 1,00');
      console.log(`   MySQL:      R$ ${parseFloat(totalMySQLGeral.valor_total).toFixed(2)}`);
      console.log(`   PostgreSQL: R$ ${parseFloat(String(totalGeralPG._sum.valor || 0)).toFixed(2)}\n`);
    } else {
      console.log('❌ TOTAL GERAL diverge!');
      console.log(`   Diferença: R$ ${difValorGeral.toFixed(2)}\n`);
    }

    if (Math.abs(difValorPens) > 1) {
      console.log('⚠️  PENSIONISTAS divergem!');
      console.log(`   Faltam ${difPens} parcelas (R$ ${difValorPens.toFixed(2)})`);
      console.log(`   Percentual migrado: ${((pensionistasPG._count / totalMySQLPensionistas.qtd_parcelas) * 100).toFixed(1)}%\n`);
      
      console.log('   POSSÍVEL CAUSA:');
      console.log('   - Problema no filtro de codTipo na migração');
      console.log('   - Pensionistas não foram associados corretamente às vendas');
      console.log('   - Campo codTipo não foi migrado corretamente\n');
    } else {
      console.log('✅ PENSIONISTAS estão corretos!\n');
    }

    if (Math.abs(difValorOutros) > 1) {
      console.log('⚠️  OUTROS TIPOS divergem!');
      console.log(`   Diferença: ${difOutros} parcelas (R$ ${difValorOutros.toFixed(2)})\n`);
    } else {
      console.log('✅ OUTROS TIPOS estão corretos!\n');
    }

  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✓ Verificação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    process.exit(1);
  });

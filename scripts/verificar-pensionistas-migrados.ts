/**
 * Verifica quantos sócios pensionistas (codTipo 3 e 4) foram migrados
 * para o PostgreSQL Railway
 */

import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

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
  console.log('  VERIFICAÇÃO: SÓCIOS PENSIONISTAS MIGRADOS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // Total de pensionistas no MySQL
    const [mysqlPensionistas] = await conn.execute(`
      SELECT COUNT(*) as total
      FROM socios
      WHERE codtipo = '3' OR codtipo = '4'
    `) as any;

    console.log(`MySQL - Total de pensionistas: ${mysqlPensionistas[0].total}`);

    // Lista de matrículas de pensionistas no MySQL
    const [matriculasMysql] = await conn.execute(`
      SELECT matricula, TRIM(nome) as nome, codtipo
      FROM socios
      WHERE codtipo = '3' OR codtipo = '4'
      ORDER BY matricula
    `) as any;

    // Total de pensionistas no PostgreSQL
    const pgPensionistas = await prisma.socio.count({
      where: {
        codTipo: { in: [3, 4] }
      }
    });

    console.log(`PostgreSQL - Total de pensionistas: ${pgPensionistas}`);

    // Buscar pensionistas no PostgreSQL
    const pgPensionistasLista = await prisma.socio.findMany({
      where: {
        codTipo: { in: [3, 4] }
      },
      select: {
        matricula: true,
        nome: true,
        codTipo: true
      }
    });

    // Criar mapa de matrículas no PostgreSQL
    const pgMatriculas = new Set(
      pgPensionistasLista.map(s => s.matricula?.trim()).filter(Boolean)
    );

    // Verificar quantas matrículas do MySQL estão no PostgreSQL
    let encontradas = 0;
    let naoEncontradas: any[] = [];

    for (const mysql of matriculasMysql) {
      const matTrim = String(mysql.matricula).trim();
      if (pgMatriculas.has(matTrim)) {
        encontradas++;
      } else {
        if (naoEncontradas.length < 20) { // Limitar exemplos
          naoEncontradas.push({
            matricula: mysql.matricula,
            nome: mysql.nome,
            codtipo: mysql.codtipo
          });
        }
      }
    }

    console.log(`\nMatrículas encontradas no PostgreSQL: ${encontradas}`);
    console.log(`Matrículas NÃO encontradas: ${matriculasMysql.length - encontradas}`);
    console.log(`Taxa de migração: ${((encontradas / matriculasMysql.length) * 100).toFixed(1)}%`);

    if (naoEncontradas.length > 0) {
      console.log('\n⚠️  Exemplos de pensionistas NÃO migrados:');
      console.log(JSON.stringify(naoEncontradas.slice(0, 10), null, 2));
    }

    // Verificar se existe mapeamento de matrículas
    const [mapeamentos] = await conn.execute(`
      SELECT COUNT(*) as total
      FROM matriculas
    `) as any;

    console.log(`\nMapeamentos de matrícula (tabela matriculas): ${mapeamentos[0].total}`);

    // Verificar se pensionistas têm vendas com parcelas em mar/2026
    const [pensionistasComParcelas] = await conn.execute(`
      SELECT DISTINCT s.matricula, TRIM(s.nome) as nome, s.codtipo, COUNT(p.nrseq) as qtd_parcelas
      FROM socios s
      INNER JOIN parcelas p ON TRIM(s.matricula) = TRIM(p.matricula)
      WHERE (s.codtipo = '3' OR s.codtipo = '4')
        AND MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
      GROUP BY s.matricula, s.nome, s.codtipo
      ORDER BY s.matricula
    `) as any;

    console.log(`\nPensionistas com parcelas em mar/2026 (MySQL): ${pensionistasComParcelas.length}`);

    // Verificar quantos desses estão no PostgreSQL
    let pensionistasComParcelasMigrados = 0;
    for (const p of pensionistasComParcelas) {
      const matTrim = String(p.matricula).trim();
      if (pgMatriculas.has(matTrim)) {
        pensionistasComParcelasMigrados++;
      }
    }

    console.log(`Pensionistas com parcelas já migrados: ${pensionistasComParcelasMigrados}`);
    console.log(`Pensionistas com parcelas NÃO migrados: ${pensionistasComParcelas.length - pensionistasComParcelasMigrados}`);

    // Análise final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ANÁLISE');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (pensionistasComParcelasMigrados < pensionistasComParcelas.length) {
      console.log('❌ PROBLEMA IDENTIFICADO:');
      console.log(`   ${pensionistasComParcelas.length - pensionistasComParcelasMigrados} pensionistas que TÊM parcelas em mar/2026`);
      console.log('   NÃO foram migrados para o PostgreSQL.');
      console.log('\n   Isso explica por que apenas 134 parcelas foram encontradas');
      console.log('   no PostgreSQL, quando deveriam ser 2.453.');
      console.log('\n   SOLUÇÃO: Re-executar migração de sócios (migrate-all-to-railway.ts)');
    } else {
      console.log('✅ Todos os pensionistas com parcelas foram migrados.');
      console.log('   O problema deve estar na migração de vendas/parcelas.');
    }

  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✓ Verificação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    process.exit(1);
  });

/**
 * COMPARAÇÃO ESPECÍFICA - PENSIONISTAS (Mar/2026)
 * 
 * Compara as parcelas de pensionistas entre MySQL e PostgreSQL
 * usando a mesma estratégia do relatório de comparação
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
  console.log('  COMPARAÇÃO PENSIONISTAS: MySQL vs PostgreSQL');
  console.log('  Período: Março/2026');
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // ══════════════════════════════════════════════════════════════════
    // 1. BUSCAR TODAS AS PARCELAS DE MARÇO/2026 NO MYSQL
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 1. Consultando MySQL - TODAS as parcelas de março/2026...\n');

    const [todasParcelasMySQL] = await conn.execute(`
      SELECT 
        TRIM(p.matricula) as matricula,
        TRIM(p.associado) as associado,
        TRIM(p.codconven) as convenio_codigo,
        TRIM(p.conveniado) as convenio_nome,
        CAST(p.nrseq AS UNSIGNED) as num_parcela,
        p.parcelas as qtd_parcelas,
        p.sequencia,
        p.valor,
        p.baixa as status,
        p.vencimento
      FROM parcelas p
      WHERE YEAR(p.vencimento) = 2026 AND MONTH(p.vencimento) = 3
    `);

    console.log(`Total de parcelas no MySQL (março/2026): ${(todasParcelasMySQL as any[]).length}`);

    // ══════════════════════════════════════════════════════════════════
    // 2. IDENTIFICAR QUAIS SÃO DE PENSIONISTAS
    // ══════════════════════════════════════════════════════════════════
    console.log('\n📦 2. Identificando pensionistas (codTipo 3 e 4)...\n');

    const [sociosPensionistas] = await conn.execute(`
      SELECT TRIM(matricula) as matricula, codtipo, TRIM(associado) as nome
      FROM socios
      WHERE codtipo = '3' OR codtipo = '4'
    `);

    const matriculasPensionistas = new Set(
      (sociosPensionistas as any[]).map(s => s.matricula)
    );

    console.log(`Total de pensionistas no MySQL (tabela socios): ${matriculasPensionistas.size}`);

    // Filtrar parcelas de pensionistas
    const parcelasPensionistasMySQL = (todasParcelasMySQL as any[]).filter(p => 
      matriculasPensionistas.has(p.matricula)
    );

    console.log(`Parcelas de pensionistas no MySQL: ${parcelasPensionistasMySQL.length}`);

    // Calcular total
    const totalMySQLPensionistas = parcelasPensionistasMySQL.reduce(
      (sum, p) => sum + parseFloat(p.valor || 0), 0
    );

    // Filtrar apenas parcelas em aberto (sem baixa)
    const parcelasPensionistasAbertoMySQL = parcelasPensionistasMySQL.filter(p =>
      !p.status || p.status.trim() === '' || p.status.trim() === 'N'
    );

    console.log(`Parcelas em aberto (sem baixa): ${parcelasPensionistasAbertoMySQL.length}`);

    const totalMySQLAberto = parcelasPensionistasAbertoMySQL.reduce(
      (sum, p) => sum + parseFloat(p.valor || 0), 0
    );

    // ══════════════════════════════════════════════════════════════════
    // 3. BUSCAR TODAS AS PARCELAS DE MARÇO/2026 NO POSTGRESQL
    // ══════════════════════════════════════════════════════════════════
    console.log('\n📦 3. Consultando PostgreSQL - TODAS as parcelas de março/2026...\n');

    const dataInicio = new Date(2026, 2, 1, 0, 0, 0); // março = índice 2
    const dataFim = new Date(2026, 3, 0, 23, 59, 59); // último dia de março

    const todasParcelasPG = await prisma.parcela.findMany({
      where: {
        dataVencimento: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      include: {
        venda: {
          select: {
            numeroVenda: true,
            quantidadeParcelas: true,
            socio: {
              select: {
                matricula: true,
                nome: true,
                codTipo: true,
              },
            },
            convenio: {
              select: {
                codigo: true,
                razao_soc: true,
              },
            },
          },
        },
      },
    });

    console.log(`Total de parcelas no PostgreSQL (março/2026): ${todasParcelasPG.length}`);

    // ══════════════════════════════════════════════════════════════════
    // 4. FILTRAR PENSIONISTAS NO POSTGRESQL
    // ══════════════════════════════════════════════════════════════════
    console.log('\n📦 4. Filtrando pensionistas no PostgreSQL...\n');

    const parcelasPensionistassPG = todasParcelasPG.filter(p => 
      p.venda.socio.codTipo === 3 || p.venda.socio.codTipo === 4
    );

    console.log(`Parcelas de pensionistas no PostgreSQL: ${parcelasPensionistassPG.length}`);

    const totalPGPensionistas = parcelasPensionistassPG.reduce(
      (sum, p) => sum + parseFloat(String(p.valor)), 0
    );

    // Filtrar apenas parcelas em aberto
    const parcelasPensionistasAbertoPG = parcelasPensionistassPG.filter(p =>
      !p.baixa || p.baixa.trim() === '' || p.baixa.trim() === 'N'
    );

    console.log(`Parcelas em aberto (sem baixa): ${parcelasPensionistasAbertoPG.length}`);

    const totalPGAberto = parcelasPensionistasAbertoPG.reduce(
      (sum, p) => sum + parseFloat(String(p.valor)), 0
    );

    // ══════════════════════════════════════════════════════════════════
    // 5. COMPARAÇÃO FINAL
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  COMPARAÇÃO FINAL - PENSIONISTAS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ TODAS AS PARCELAS (com e sem baixa)                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ MySQL:      ${parcelasPensionistasMySQL.length.toString().padStart(6)} parcelas - R$ ${totalMySQLPensionistas.toFixed(2).padStart(12)}  │`);
    console.log(`│ PostgreSQL: ${parcelasPensionistassPG.length.toString().padStart(6)} parcelas - R$ ${totalPGPensionistas.toFixed(2).padStart(12)}  │`);
    console.log(`│ Diferença:  ${(parcelasPensionistasMySQL.length - parcelasPensionistassPG.length).toString().padStart(6)} parcelas - R$ ${(totalMySQLPensionistas - totalPGPensionistas).toFixed(2).padStart(12)}  │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ PARCELAS EM ABERTO (sem baixa) - AS302.PRG             │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ MySQL:      ${parcelasPensionistasAbertoMySQL.length.toString().padStart(6)} parcelas - R$ ${totalMySQLAberto.toFixed(2).padStart(12)}  │`);
    console.log(`│ PostgreSQL: ${parcelasPensionistasAbertoPG.length.toString().padStart(6)} parcelas - R$ ${totalPGAberto.toFixed(2).padStart(12)}  │`);
    console.log(`│ Diferença:  ${(parcelasPensionistasAbertoMySQL.length - parcelasPensionistasAbertoPG.length).toString().padStart(6)} parcelas - R$ ${(totalMySQLAberto - totalPGAberto).toFixed(2).padStart(12)}  │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // ══════════════════════════════════════════════════════════════════
    // 6. ANÁLISE DE MATRÍCULAS FALTANTES
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ANÁLISE DE MATRÍCULAS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Matrículas de pensionistas no PostgreSQL
    const sociosPG = await prisma.socio.findMany({
      where: {
        codTipo: { in: [3, 4] }
      },
      select: { matricula: true, nome: true, codTipo: true }
    });

    const matriculasPGSet = new Set(
      sociosPG.map(s => s.matricula?.trim()).filter(Boolean)
    );

    console.log(`Pensionistas cadastrados no MySQL:      ${matriculasPensionistas.size}`);
    console.log(`Pensionistas cadastrados no PostgreSQL: ${matriculasPGSet.size}`);
    console.log(`Diferença:                               ${matriculasPensionistas.size - matriculasPGSet.size}`);

    // Encontrar matrículas que estão no MySQL mas não no PostgreSQL
    const matriculasFaltantes: string[] = [];
    for (const mat of matriculasPensionistas) {
      if (!matriculasPGSet.has(mat)) {
        matriculasFaltantes.push(mat);
      }
    }

    if (matriculasFaltantes.length > 0) {
      console.log(`\n⚠️  ${matriculasFaltantes.length} pensionistas não foram migrados!`);
      console.log('\nExemplos de matrículas faltantes (primeiras 10):');
      const exemplos = matriculasFaltantes.slice(0, 10);
      
      for (const mat of exemplos) {
        const socioInfo = (sociosPensionistas as any[]).find(s => s.matricula === mat);
        console.log(`  - Matrícula: ${mat} - ${socioInfo?.nome || 'N/A'} (Tipo: ${socioInfo?.codtipo})`);
      }
    } else {
      console.log('\n✅ Todos os pensionistas foram migrados!');
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. CONCLUSÃO
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  CONCLUSÃO');
    console.log('═══════════════════════════════════════════════════════════\n');

    const percentualMigrado = ((parcelasPensionistasAbertoPG.length / parcelasPensionistasAbertoMySQL.length) * 100);

    if (percentualMigrado < 100) {
      console.log(`❌ PROBLEMA IDENTIFICADO:`);
      console.log(`   Apenas ${percentualMigrado.toFixed(1)}% das parcelas de pensionistas foram migradas.`);
      console.log(`   Faltam ${parcelasPensionistasAbertoMySQL.length - parcelasPensionistasAbertoPG.length} parcelas (R$ ${(totalMySQLAberto - totalPGAberto).toFixed(2)})`);
      
      if (matriculasFaltantes.length > 0) {
        console.log(`\n   CAUSA RAIZ:`);
        console.log(`   ${matriculasFaltantes.length} pensionistas não foram migrados para a tabela socios.`);
        console.log(`   Isso impede que suas vendas e parcelas sejam criadas.`);
        console.log(`\n   SOLUÇÃO:`);
        console.log(`   1. Re-executar migração de sócios (migrate-all-to-railway.ts)`);
        console.log(`   2. Re-executar migração de vendas/parcelas (migrate-vendas-parcelas-v2.ts)`);
      }
    } else {
      console.log(`✅ Migração completa! ${percentualMigrado.toFixed(1)}% das parcelas foram migradas.`);
    }

  } finally {
    await conn.end();
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
    process.exit(1);
  });

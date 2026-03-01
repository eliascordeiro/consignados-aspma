/**
 * DIAGNÓSTICO: Diferença de R$ 1.503,11 entre MySQL e PostgreSQL
 * Pensionistas – Março/2026
 *
 * Investiga:
 *  1. Totais brutos de cada base
 *  2. Parcelas em aberto no MySQL mas com baixa diferente no PG
 *  3. Totais por valor de baixa no PG (X, S, N, null, etc.)
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

const ANO = 2026;
const MES = 3; // Março

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  DIAGNÓSTICO PENSIONISTAS – ${String(MES).padStart(2,'0')}/${ANO}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // ── 1. MYSQL: total em aberto ────────────────────────────────────────────
    const [mysqlRows] = await conn.execute(`
      SELECT 
        p.matricula,
        TRIM(p.associado) as associado,
        TRIM(s.codtipo)   as codtipo,
        p.codconven,
        TRIM(p.conveniado) as conveniado,
        CAST(p.nrseq AS UNSIGNED) as nrseq,
        p.parcelas,
        p.sequencia,
        CAST(p.valor AS DECIMAL(12,2)) as valor,
        p.baixa
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = ?
        AND MONTH(p.vencimento) = ?
        AND TRIM(p.baixa) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
      ORDER BY p.associado, p.matricula, p.sequencia, p.nrseq
    `, [ANO, MES]) as [any[], any];

    const mysqlTotal = (mysqlRows as any[]).reduce((s: number, r: any) => s + parseFloat(r.valor), 0);
    console.log(`📊 MySQL  – Pensionistas em aberto : ${mysqlRows.length} parcelas  |  R$ ${mysqlTotal.toFixed(2)}`);

    // ── 2. MYSQL: todas (sem filtro de baixa) ────────────────────────────────
    const [mysqlAll] = await conn.execute(`
      SELECT COUNT(*) as total, COALESCE(SUM(CAST(p.valor AS DECIMAL(12,2))),0) as soma
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = ?
        AND MONTH(p.vencimento) = ?
        AND (s.codtipo = '3' OR s.codtipo = '4')
    `, [ANO, MES]) as [any[], any];
    const rowAll = (mysqlAll as any[])[0];
    console.log(`   MySQL  – TODAS (incl. baixadas) : ${rowAll.total} parcelas  |  R$ ${parseFloat(rowAll.soma).toFixed(2)}`);

    // ── 3. MYSQL: distribuição de baixa ──────────────────────────────────────
    const [mysqlBaixaDist] = await conn.execute(`
      SELECT COALESCE(NULLIF(TRIM(p.baixa),''), '(vazio)') as baixa, COUNT(*) as qtd,
             COALESCE(SUM(CAST(p.valor AS DECIMAL(12,2))),0) as soma
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = ?
        AND MONTH(p.vencimento) = ?
        AND (s.codtipo = '3' OR s.codtipo = '4')
      GROUP BY COALESCE(NULLIF(TRIM(p.baixa),''), '(vazio)')
      ORDER BY qtd DESC
    `, [ANO, MES]) as [any[], any];

    console.log('\n   MySQL – distribuição do campo baixa:');
    (mysqlBaixaDist as any[]).forEach((r: any) => {
      console.log(`     baixa='${r.baixa}' : ${r.qtd} parcelas  |  R$ ${parseFloat(r.soma).toFixed(2)}`);
    });

    // ── 4. POSTGRESQL: total com filtro padrão (igual ao relatório) ──────────
    const dataInicio = new Date(ANO, MES - 1, 1, 0, 0, 0);
    const dataFim    = new Date(ANO, MES, 0, 23, 59, 59, 999);

    const pgParcelas = await prisma.parcela.findMany({
      where: {
        dataVencimento: { gte: dataInicio, lte: dataFim },
        OR: [
          { baixa: null },
          { baixa: '' },
          { baixa: ' ' },
          { baixa: 'N' },
        ],
        venda: { socio: { codTipo: { in: [3, 4] } } },
      },
      select: { id: true, valor: true, baixa: true },
    });

    const pgTotal = pgParcelas.reduce((s, p) => s + Number(p.valor), 0);
    console.log(`\n📊 PG (PostgreSQL) – Pensionistas em aberto : ${pgParcelas.length} parcelas  |  R$ ${pgTotal.toFixed(2)}`);
    console.log(`\n   ❗ Diferença MySQL - PG : R$ ${(mysqlTotal - pgTotal).toFixed(2)}`);

    // ── 5. POSTGRESQL: distribuição de TODAS as baixas no mês ───────────────
    console.log('\n   PG – distribuição do campo baixa (TODAS as parcelas de pensionistas no mês):');

    const pgDist = await prisma.$queryRaw<{ baixa: string | null; qtd: bigint; soma: number }[]>`
      SELECT 
        p.baixa,
        COUNT(*)::bigint as qtd,
        COALESCE(SUM(p.valor),0) as soma
      FROM parcelas p
      JOIN vendas v ON p."vendaId" = v.id
      JOIN socios s ON v."socioId" = s.id
      WHERE p."dataVencimento" >= ${dataInicio}
        AND p."dataVencimento" <= ${dataFim}
        AND s."codTipo" IN (3, 4)
      GROUP BY p.baixa
      ORDER BY qtd DESC
    `;

    pgDist.forEach((r) => {
      console.log(`     baixa='${r.baixa ?? 'null'}' : ${r.qtd} parcelas  |  R$ ${Number(r.soma).toFixed(2)}`);
    });

    // ── 6. POSTGRESQL: parcelas com baixa = 'X' ou 'S' ─────────────────────
    //    → provável causa: estão em aberto no MySQL mas "baixadas" no PG
    console.log('\n   PG – parcelas com baixa em {X, S, B} (excluídas pelo relatório):');

    const pgBaixadas = await prisma.parcela.findMany({
      where: {
        dataVencimento: { gte: dataInicio, lte: dataFim },
        baixa: { in: ['X', 'S', 'B'] },
        venda: { socio: { codTipo: { in: [3, 4] } } },
      },
      select: {
        id: true,
        valor: true,
        baixa: true,
        numeroParcela: true,
        venda: {
          select: {
            numeroVenda: true,
            quantidadeParcelas: true,
            socio: { select: { matricula: true, nome: true } },
            convenio: { select: { razao_soc: true } },
          },
        },
      },
      orderBy: [
        { venda: { socio: { nome: 'asc' } } },
        { numeroParcela: 'asc' },
      ],
    });

    const totalBaixadasPG = pgBaixadas.reduce((s, p) => s + Number(p.valor), 0);
    console.log(`     Total: ${pgBaixadas.length} parcelas  |  R$ ${totalBaixadasPG.toFixed(2)}`);

    if (pgBaixadas.length > 0) {
      console.log('\n   Detalhes:');
      pgBaixadas.forEach((p) => {
        const mat  = p.venda.socio.matricula?.padEnd(8) ?? '--------';
        const nome = (p.venda.socio.nome ?? '').substring(0, 35).padEnd(35);
        const conv = (p.venda.convenio?.razao_soc ?? 'SEM CONV').substring(0, 25).padEnd(25);
        console.log(
          `     Matric: ${mat}  ${nome}  Conv: ${conv}  ` +
          `Parc: ${String(p.numeroParcela).padStart(2,'0')}/${p.venda.quantidadeParcelas}  ` +
          `Valor: R$ ${Number(p.valor).toFixed(2).padStart(10)}  baixa=${p.baixa}`
        );
      });
    }

    // ── 7. Cruzamento: achar key chave MySQL não encontrada no PG ────────────
    console.log('\n   🔍 Cruzamento: parcelas MySQL em aberto sem correspondência no PG...');

    // Buscar chaves identificadoras no PG (matricula + sequencia/vendaId + nrseq)
    const pgKeys = await prisma.$queryRaw<{matricula: string | null; numeroVenda: number; numeroParcela: number}[]>`
      SELECT s.matricula, v."numeroVenda", p."numeroParcela"
      FROM parcelas p
      JOIN vendas v ON p."vendaId" = v.id
      JOIN socios s ON v."socioId" = s.id
      WHERE p."dataVencimento" >= ${dataInicio}
        AND p."dataVencimento" <= ${dataFim}
        AND s."codTipo" IN (3, 4)
        AND (p.baixa IS NULL OR TRIM(p.baixa) = '' OR p.baixa IN ('N', ' '))
    `;

    // Identificar registros do MySQL que não batem no PG pelo par (matricula, nrseq)
    // No MySQL: sequencia = numeroVenda, nrseq = numeroParcela
    const pgSet = new Set(pgKeys.map(k => `${(k.matricula ?? '').trim()}_${k.numeroVenda}_${k.numeroParcela}`));

    const mysqlOrfaos = (mysqlRows as any[]).filter((r: any) => {
      const key = `${(r.matricula ?? '').trim()}_${r.sequencia}_${r.nrseq}`;
      return !pgSet.has(key);
    });

    const totalOrfaos = mysqlOrfaos.reduce((s: number, r: any) => s + parseFloat(r.valor), 0);
    console.log(`     MySQL em aberto sem par no PG: ${mysqlOrfaos.length} parcelas  |  R$ ${totalOrfaos.toFixed(2)}`);

    if (mysqlOrfaos.length > 0 && mysqlOrfaos.length <= 50) {
      console.log('\n   Detalhes:');
      mysqlOrfaos.forEach((r: any) => {
        const mat  = String(r.matricula ?? '').trim().padEnd(8);
        const nome = String(r.associado ?? '').substring(0, 35).padEnd(35);
        console.log(
          `     Matric: ${mat}  ${nome}  Seq: ${r.sequencia}  ` +
          `Parc: ${String(r.nrseq).padStart(2,'0')}/${r.parcelas}  ` +
          `Valor: R$ ${parseFloat(r.valor).toFixed(2).padStart(10)}  baixa_mysql='${r.baixa}'`
        );
      });
    }

    // ── 8. Resumo ────────────────────────────────────────────────────────────
    console.log('\n═══════════════════ RESUMO ══════════════════════════════════');
    console.log(`  MySQL total em aberto  : R$ ${mysqlTotal.toFixed(2)}`);
    console.log(`  PG    total em aberto  : R$ ${pgTotal.toFixed(2)}`);
    console.log(`  Diferença (MySQL - PG) : R$ ${(mysqlTotal - pgTotal).toFixed(2)}`);
    console.log(`  PG parcelas baixa X/S/B: ${pgBaixadas.length} parcelas  |  R$ ${totalBaixadasPG.toFixed(2)}`);
    console.log(`  MySQL sem par no PG    : ${mysqlOrfaos.length} parcelas  |  R$ ${totalOrfaos.toFixed(2)}`);
    if (Math.abs(totalBaixadasPG - (mysqlTotal - pgTotal)) < 1) {
      console.log('\n  ✅ CAUSA PROVÁVEL: Parcelas com baixa=X/S no PG mas em aberto no MySQL');
      console.log('     → Execute corrigir-baixas-mar2026.ts para corrigir');
    }
    console.log('═══════════════════════════════════════════════════════════\n');

  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

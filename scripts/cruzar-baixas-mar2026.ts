/**
 * CRUZAMENTO: Parcelas com baixa='S' no PG × status no MySQL
 * Pensionistas – Março/2026
 *
 * Objetivo: Confirmar quais das 127 parcelas marcadas como 'S' no PG
 *           estão REALMENTE em aberto no MySQL (baixa='') ANTES de corrigir.
 *
 * Resultado esperado:
 *  - Grupo A: PG='S' e MySQL='' → INDEVIDA no PG, candidata à correção
 *  - Grupo B: PG='S' e MySQL='X'/'S'/outra → baixada em ambos, não corrigir
 *  - Grupo C: PG='S' e sem par no MySQL → parcela nova no PG sem correspondência legada
 */
import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST     || '200.98.112.240',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER     || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

const ANO = 2026;
const MES = 3; // Março

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  CRUZAMENTO baixa=S no PG × MySQL – Pensionistas ${String(MES).padStart(2,'0')}/${ANO}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);
  const dataInicio = new Date(ANO, MES - 1, 1, 0, 0, 0);
  const dataFim    = new Date(ANO, MES, 0, 23, 59, 59, 999);

  try {
    // ── 1. Buscar as 127 parcelas PG com baixa='S' ──────────────────────────
    const pgBaixadas = await prisma.parcela.findMany({
      where: {
        dataVencimento: { gte: dataInicio, lte: dataFim },
        baixa: { in: ['S', 'X', 'B'] },
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
            socio: { select: { matricula: true, nome: true, codTipo: true } },
            convenio: { select: { razao_soc: true } },
          },
        },
      },
      orderBy: [
        { venda: { socio: { nome: 'asc' } } },
        { numeroParcela: 'asc' },
      ],
    });

    console.log(`PG: ${pgBaixadas.length} parcelas com baixa em {S,X,B} para pensionistas em ${String(MES).padStart(2,'0')}/${ANO}`);

    if (pgBaixadas.length === 0) {
      console.log('Nenhuma parcela para analisar. Encerrando.');
      return;
    }

    // ── 2. Para cada parcela do PG, buscar o par no MySQL ────────────────────
    // Chave: matricula + sequencia (numeroVenda) + nrseq (numeroParcela) + vencimento
    const grupoA: typeof pgBaixadas = []; // PG='S' e MySQL=''   → CORRIGIR
    const grupoB: typeof pgBaixadas = []; // PG='S' e MySQL≠''   → já baixada em ambos
    const grupoC: typeof pgBaixadas = []; // PG='S' e sem par no MySQL
    const detalhes: {pg: (typeof pgBaixadas)[0], mysqlBaixa: string | null}[] = [];

    for (const parc of pgBaixadas) {
      const mat = (parc.venda.socio.matricula ?? '').trim();
      const seq = parc.venda.numeroVenda;
      const nrseq = parc.numeroParcela;

      const [rows] = await conn.execute(`
        SELECT TRIM(p.baixa) as baixa, p.valor
        FROM parcelas p
        LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
        WHERE TRIM(p.matricula) = ?
          AND p.sequencia = ?
          AND p.nrseq = ?
          AND YEAR(p.vencimento) = ?
          AND MONTH(p.vencimento) = ?
          AND (s.codtipo = '3' OR s.codtipo = '4')
        LIMIT 1
      `, [mat, seq, nrseq, ANO, MES]) as [any[], any];

      const mysqlBaixa: string | null = rows.length > 0 ? (rows[0].baixa ?? null) : null;

      detalhes.push({ pg: parc, mysqlBaixa });

      if (rows.length === 0) {
        grupoC.push(parc);
      } else if (mysqlBaixa === '' || mysqlBaixa === null) {
        grupoA.push(parc);
      } else {
        grupoB.push(parc);
      }
    }

    // ── 3. Relatório Grupo A (candidatas à correção) ─────────────────────────
    const totalA = grupoA.reduce((s, p) => s + Number(p.valor), 0);
    console.log(`\n✅ GRUPO A – PG='S' e MySQL='' (em aberto no legado) → CANDIDATAS À CORREÇÃO`);
    console.log(`   ${grupoA.length} parcelas  |  R$ ${totalA.toFixed(2)}`);

    if (grupoA.length > 0) {
      console.log('\n   Detalhes:');
      grupoA.forEach((p) => {
        const mat  = (p.venda.socio.matricula ?? '').trim().padEnd(8);
        const nome = (p.venda.socio.nome ?? '').substring(0, 35).padEnd(35);
        console.log(
          `   Matric: ${mat}  ${nome}  ` +
          `Parc: ${String(p.numeroParcela).padStart(2,'0')}/${p.venda.quantidadeParcelas}  ` +
          `Valor: R$ ${Number(p.valor).toFixed(2).padStart(10)}  PG.baixa=${p.baixa}  MySQL.baixa=''`
        );
      });
    }

    // ── 4. Relatório Grupo B (baixada em ambos — não corrigir) ───────────────
    const totalB = grupoB.reduce((s, p) => s + Number(p.valor), 0);
    console.log(`\n⚠️  GRUPO B – PG='S' e MySQL≠'' (baixada em ambos) → NÃO CORRIGIR`);
    console.log(`   ${grupoB.length} parcelas  |  R$ ${totalB.toFixed(2)}`);

    if (grupoB.length > 0 && grupoB.length <= 30) {
      console.log('\n   Detalhes:');
      grupoB.forEach((p) => {
        const det = detalhes.find(d => d.pg.id === p.id);
        const mat  = (p.venda.socio.matricula ?? '').trim().padEnd(8);
        const nome = (p.venda.socio.nome ?? '').substring(0, 35).padEnd(35);
        console.log(
          `   Matric: ${mat}  ${nome}  ` +
          `Parc: ${String(p.numeroParcela).padStart(2,'0')}/${p.venda.quantidadeParcelas}  ` +
          `Valor: R$ ${Number(p.valor).toFixed(2).padStart(10)}  PG.baixa=${p.baixa}  MySQL.baixa='${det?.mysqlBaixa}'`
        );
      });
    }

    // ── 5. Relatório Grupo C (sem par no MySQL) ──────────────────────────────
    const totalC = grupoC.reduce((s, p) => s + Number(p.valor), 0);
    console.log(`\n🔵 GRUPO C – PG='S' e sem par no MySQL (parcela só existe no PG)`);
    console.log(`   ${grupoC.length} parcelas  |  R$ ${totalC.toFixed(2)}`);

    if (grupoC.length > 0 && grupoC.length <= 20) {
      console.log('\n   Detalhes:');
      grupoC.forEach((p) => {
        const mat  = (p.venda.socio.matricula ?? '').trim().padEnd(8);
        const nome = (p.venda.socio.nome ?? '').substring(0, 35).padEnd(35);
        console.log(
          `   Matric: ${mat}  ${nome}  ` +
          `Parc: ${String(p.numeroParcela).padStart(2,'0')}/${p.venda.quantidadeParcelas}  ` +
          `Valor: R$ ${Number(p.valor).toFixed(2).padStart(10)}  PG.baixa=${p.baixa}  MySQL=SEM PAR`
        );
      });
    }

    // ── 6. Resumo e recomendação ─────────────────────────────────────────────
    console.log('\n═══════════════════════════════ RESUMO ════════════════════════');
    console.log(`  Total PG com baixa=S/X/B: ${pgBaixadas.length} parcelas  |  R$ ${(totalA+totalB+totalC).toFixed(2)}`);
    console.log(`  Grupo A (corrigir)       : ${grupoA.length} parcelas  |  R$ ${totalA.toFixed(2)}`);
    console.log(`  Grupo B (não corrigir)   : ${grupoB.length} parcelas  |  R$ ${totalB.toFixed(2)}`);
    console.log(`  Grupo C (só no PG)       : ${grupoC.length} parcelas  |  R$ ${totalC.toFixed(2)}`);

    if (grupoA.length > 0) {
      console.log(`\n  ➡️  Execute corrigir-baixas-mar2026.ts para corrigir ${grupoA.length} parcelas (R$ ${totalA.toFixed(2)})`);
      // Exportar IDs para o script de correção
      const ids = grupoA.map(p => `'${p.id}'`).join(',\n  ');
      console.log(`\n  IDs para corrigir (copiar para corrigir-baixas-mar2026.ts):\n  ${ids}`);
    } else {
      console.log('\n  ✅ Nenhuma parcela incorreta encontrada — nada a corrigir.');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

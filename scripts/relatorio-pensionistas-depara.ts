/**
 * relatorio-pensionistas-depara.ts
 *
 * Relatório de parcelas de Pensionistas/Dependentes (codTipo 3 e 4) usando a
 * tabela 'matriculas' (de-para) para normalizar matrículas antigas/atuais.
 *
 * Inclui comparação com MySQL legado para validação.
 *
 * Uso:
 *   npx tsx scripts/relatorio-pensionistas-depara.ts             (padrão: março/2026)
 *   npx tsx scripts/relatorio-pensionistas-depara.ts --mes=3 --ano=2026
 *   npx tsx scripts/relatorio-pensionistas-depara.ts --mes=2 --ano=2026 --sem-mysql
 */

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const MYSQL_CONFIG = {
  host:     process.env.MYSQL_HOST     || '200.98.112.240',
  port:     parseInt(process.env.MYSQL_PORT || '3306'),
  user:     process.env.MYSQL_USER     || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs(): { mes: number; ano: number; semMysql: boolean } {
  const args = process.argv.slice(2);
  let mes  = 3;
  let ano  = 2026;
  let semMysql = false;

  for (const arg of args) {
    if (arg.startsWith('--mes='))      mes      = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--ano='))      ano      = parseInt(arg.split('=')[1]);
    if (arg === '--sem-mysql')         semMysql = true;
  }
  return { mes, ano, semMysql };
}

function nomeMes(mes: number): string {
  return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mes - 1] ?? String(mes);
}

function formatarDataBR(data: Date | string): string {
  const d = new Date(data);
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

function gerarCSV(dados: Record<string, unknown>[], colunas: string[]): string {
  const linhas = [colunas.join(';')];
  for (const item of dados) {
    const valores = colunas.map(col => {
      const v = item[col];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return `"${v.replace(/"/g,'""')}"`;
      return String(v);
    });
    linhas.push(valores.join(';'));
  }
  return linhas.join('\n');
}

function salvarCSV(caminho: string, dados: Record<string, unknown>[], colunas: string[]) {
  const csv = gerarCSV(dados, colunas);
  writeFileSync(caminho, '\uFEFF' + csv, 'utf8'); // BOM para Excel
  console.log(`   ✓ Salvo em: ${caminho}`);
}

// ─── Query PostgreSQL com de-para ─────────────────────────────────────────────

interface LinhaParcelaPG {
  matricula:       string | null;
  nome:            string;
  convenio_codigo: string | null;
  convenio_nome:   string | null;
  numero_venda:    number;
  num_parcela:     number;
  qtd_parcelas:    number;
  valor:           Decimal | string;
  baixa:           string | null;
  data_vencimento: Date | string;
  cod_tipo:        number | null;
}

async function buscarParcelasPG(mes: number, ano: number): Promise<LinhaParcelaPG[]> {
  /*
   * CTE socios_pensionistas: coleta os IDs de todos os sócios que devem
   * aparecer no relatório de pensionistas/dependentes, incluindo sócios
   * cuja matrícula de-para aponta para um sócio com codTipo 3 ou 4.
   *
   * Isso resolve o caso em que:
   *   • O sócio foi migrado com a matrícula_atual mas seu codTipo estava na
   *     linha da matrícula_antiga (ou vice-versa) no MySQL legado.
   */
  const rows = await prisma.$queryRaw<LinhaParcelaPG[]>`
    WITH socios_pensionistas AS (
      -- Sócios diretamente classificados como pensionistas/dependentes
      SELECT s.id
      FROM socios s
      WHERE s."codTipo" IN (3, 4)

      UNION

      -- Sócios com matrícula ATUAL cujo par (matrícula ANTIGA) é pensionista
      SELECT s.id
      FROM socios s
      JOIN matriculas m ON m.matricula_atual::text = s.matricula
      JOIN socios s2    ON s2.matricula = m.matricula_antiga::text
                       AND s2."codTipo" IN (3, 4)

      UNION

      -- Sócios com matrícula ANTIGA cujo par (matrícula ATUAL) é pensionista
      SELECT s.id
      FROM socios s
      JOIN matriculas m ON m.matricula_antiga::text = s.matricula
      JOIN socios s2    ON s2.matricula = m.matricula_atual::text
                       AND s2."codTipo" IN (3, 4)
    )
    SELECT
      s.matricula,
      s.nome,
      c.codigo           AS convenio_codigo,
      c.razao_soc        AS convenio_nome,
      v."numeroVenda"    AS numero_venda,
      p."numeroParcela"  AS num_parcela,
      v."quantidadeParcelas" AS qtd_parcelas,
      p.valor,
      p.baixa,
      p."dataVencimento" AS data_vencimento,
      s."codTipo"        AS cod_tipo
    FROM parcelas p
    JOIN vendas v             ON v.id = p."vendaId"
    JOIN socios s             ON s.id = v."socioId"
    JOIN socios_pensionistas sp ON sp.id = s.id
    LEFT JOIN convenio c      ON c.id  = v."convenioId"
    WHERE EXTRACT(MONTH FROM p."dataVencimento") = ${mes}
      AND EXTRACT(YEAR  FROM p."dataVencimento") = ${ano}
      AND (p.baixa IS NULL OR TRIM(p.baixa::text) = '')
    ORDER BY s.nome, s.matricula, v."numeroVenda", p."numeroParcela"
  `;
  return rows;
}

// ─── Query MySQL legado ───────────────────────────────────────────────────────

interface LinhaMysql {
  matricula:      string;
  associado:      string;
  convenio_codigo:string;
  convenio_nome:  string;
  sequencia:      string;
  num_parcela:    number;
  qtd_parcelas:   number;
  valor:          string;
  status:         string;
  vencimento:     Date;
  codtipo:        string;
}

async function buscarParcelasMySQL(mes: number, ano: number): Promise<LinhaMysql[]> {
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  try {
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(`
      SELECT
        TRIM(p.matricula)   AS matricula,
        TRIM(p.associado)   AS associado,
        TRIM(p.codconven)   AS convenio_codigo,
        TRIM(p.conveniado)  AS convenio_nome,
        p.sequencia,
        CAST(p.nrseq AS UNSIGNED) AS num_parcela,
        p.parcelas          AS qtd_parcelas,
        p.valor,
        TRIM(p.baixa)       AS status,
        p.vencimento,
        TRIM(s.codtipo)     AS codtipo
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento)  = ?
        AND MONTH(p.vencimento) = ?
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
        AND (s.codtipo = '3' OR s.codtipo = '4')
      ORDER BY p.matricula, p.codconven, p.nrseq
    `, [ano, mes]);
    return rows as LinhaMysql[];
  } finally {
    await conn.end();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { mes, ano, semMysql } = parseArgs();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RELATÓRIO PENSIONISTAS/DEPENDENTES — COM DE-PARA');
  console.log(`  Período: ${nomeMes(mes)}/${ano}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const arquivos: string[] = [];

  // ── 1. PostgreSQL com de-para ────────────────────────────────────────────
  console.log('📄 1. PostgreSQL (com de-para)...\n');
  const rowsPG = await buscarParcelasPG(mes, ano);

  const dadosPG = rowsPG.map(p => ({
    'Matrícula':       p.matricula ?? '',
    'Associado':       p.nome,
    'Cód Convênio':    p.convenio_codigo ?? '',
    'Convênio':        p.convenio_nome ?? '',
    'Nº Venda':        p.numero_venda,
    'Nº Parcela':      p.num_parcela,
    'Qtd Parcelas':    p.qtd_parcelas,
    'Valor (R$)':      parseFloat(String(p.valor)).toFixed(2),
    'Status':          p.baixa || 'EM ABERTO',
    'Vencimento':      formatarDataBR(p.data_vencimento),
    'Tipo Sócio':      p.cod_tipo === 3 ? 'Pensionista' : 'Dependente',
  }));

  const totalPG = dadosPG.reduce((s, p) => s + parseFloat(p['Valor (R$)']), 0);
  const matriculasPG = new Set(dadosPG.map(p => p['Matrícula']));

  console.log(`   Parcelas : ${dadosPG.length}`);
  console.log(`   Matrículas únicas: ${matriculasPG.size}`);
  console.log(`   Valor total: R$ ${totalPG.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);

  const colsPG = ['Matrícula','Associado','Cód Convênio','Convênio','Nº Venda','Nº Parcela','Qtd Parcelas','Valor (R$)','Status','Vencimento','Tipo Sócio'];
  const arquivoPG = join(process.cwd(), `RELATORIO_PENSIONISTAS_PG_DEPARA_${nomeMes(mes).toUpperCase()}${ano}.csv`);
  salvarCSV(arquivoPG, dadosPG, colsPG);
  arquivos.push(arquivoPG);

  // ── 2. MySQL legado (opcional) ───────────────────────────────────────────
  if (!semMysql) {
    console.log('\n📄 2. MySQL legado...\n');
    const rowsMySQL = await buscarParcelasMySQL(mes, ano);

    const dadosMySQL = rowsMySQL.map(p => ({
      'Matrícula':       p.matricula,
      'Associado':       p.associado,
      'Cód Convênio':    p.convenio_codigo,
      'Convênio':        p.convenio_nome,
      'Sequência Venda': p.sequencia,
      'Nº Parcela':      p.num_parcela,
      'Qtd Parcelas':    p.qtd_parcelas,
      'Valor (R$)':      parseFloat(p.valor).toFixed(2),
      'Status':          p.status || 'EM ABERTO',
      'Vencimento':      formatarDataBR(p.vencimento),
      'Tipo Sócio':      p.codtipo === '3' ? 'Pensionista' : 'Dependente',
    }));

    const totalMySQL = dadosMySQL.reduce((s, p) => s + parseFloat(p['Valor (R$)']), 0);
    const matriculasMySQL = new Set(dadosMySQL.map(p => p['Matrícula']));

    console.log(`   Parcelas : ${dadosMySQL.length}`);
    console.log(`   Matrículas únicas: ${matriculasMySQL.size}`);
    console.log(`   Valor total: R$ ${totalMySQL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);

    const colsMySQL = ['Matrícula','Associado','Cód Convênio','Convênio','Sequência Venda','Nº Parcela','Qtd Parcelas','Valor (R$)','Status','Vencimento','Tipo Sócio'];
    const arquivoMySQL = join(process.cwd(), `RELATORIO_PENSIONISTAS_MYSQL_${nomeMes(mes).toUpperCase()}${ano}.csv`);
    salvarCSV(arquivoMySQL, dadosMySQL, colsMySQL);
    arquivos.push(arquivoMySQL);

    // ── 3. Divergências ──────────────────────────────────────────────────
    console.log('\n📊 COMPARATIVO PG (de-para) × MySQL\n');
    const diff = totalMySQL - totalPG;
    const pctDiff = totalMySQL > 0 ? (diff / totalMySQL) * 100 : 0;

    console.log(`   MySQL   : ${dadosMySQL.length.toString().padStart(6)} parcelas | R$ ${totalMySQL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   PG      : ${dadosPG.length.toString().padStart(6)} parcelas | R$ ${totalPG.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Δ valor : R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pctDiff.toFixed(2)}%)`);
    console.log(`   Δ parc  : ${dadosMySQL.length - dadosPG.length}`);

    // Matrículas só no MySQL
    const soNoMySQL = [...matriculasMySQL].filter(m => !matriculasPG.has(m));
    // Matrículas só no PG
    const soNoPG    = [...matriculasPG].filter(m => !matriculasMySQL.has(m));

    if (soNoMySQL.length > 0) {
      console.log(`\n   ⚠️  ${soNoMySQL.length} matrícula(s) só no MySQL (não encontradas no PG):`);
      soNoMySQL.slice(0, 20).forEach(m => {
        const assoc = dadosMySQL.find(r => r['Matrícula'] === m)?.['Associado'] ?? '';
        const total = dadosMySQL.filter(r => r['Matrícula'] === m).reduce((s,r) => s + parseFloat(r['Valor (R$)']), 0);
        console.log(`      ${m.padEnd(10)} ${assoc.substring(0,35).padEnd(35)} R$ ${total.toFixed(2)}`);
      });
      if (soNoMySQL.length > 20) console.log(`      ... e mais ${soNoMySQL.length - 20}`);
    }

    if (soNoPG.length > 0) {
      console.log(`\n   ℹ️  ${soNoPG.length} matrícula(s) só no PG (novas entradas):`);
      soNoPG.slice(0, 10).forEach(m => {
        const assoc = dadosPG.find(r => r['Matrícula'] === m)?.['Associado'] ?? '';
        console.log(`      ${m.padEnd(10)} ${assoc.substring(0,35)}`);
      });
    }

    // Salvar divergências
    const divergencias = soNoMySQL.map(mat => {
      const linhas = dadosMySQL.filter(r => r['Matrícula'] === mat);
      const totalDiv = linhas.reduce((s, r) => s + parseFloat(r['Valor (R$)']), 0);
      return {
        'Matrícula':   mat,
        'Associado':   linhas[0]?.['Associado'] ?? '',
        'Parcelas':    linhas.length,
        'Total (R$)':  totalDiv.toFixed(2),
        'Tipo Sócio':  linhas[0]?.['Tipo Sócio'] ?? '',
        'Origem':      'Só no MySQL',
      };
    });

    if (divergencias.length > 0) {
      const arquivoDiv = join(process.cwd(), `DIVERGENCIAS_PENSIONISTAS_${nomeMes(mes).toUpperCase()}${ano}.csv`);
      salvarCSV(arquivoDiv, divergencias, ['Matrícula','Associado','Parcelas','Total (R$)','Tipo Sócio','Origem']);
      arquivos.push(arquivoDiv);
    }
  }

  console.log('\n📁 ARQUIVOS GERADOS:');
  arquivos.forEach((a, i) => console.log(`   ${i+1}. ${a}`));
  console.log();
}

main()
  .then(() => { console.log('✓ Concluído!\n'); process.exit(0); })
  .catch(err => { console.error('\n✗ Erro:', err.message, '\n', err.stack); process.exit(1); })
  .finally(() => prisma.$disconnect());

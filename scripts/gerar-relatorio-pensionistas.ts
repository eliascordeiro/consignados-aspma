/**
 * GERADOR DE RELATÓRIOS DETALHADOS - PENSIONISTAS
 * 
 * Gera arquivos CSV com os dados completos de pensionistas
 * do MySQL e PostgreSQL para comparação detalhada
 */

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '200.98.112.240',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

interface ParcelaMySQL {
  matricula: string;
  associado: string;
  convenio_codigo: string;
  convenio_nome: string;
  sequencia: string;
  num_parcela: number;
  qtd_parcelas: number;
  valor: string;
  status: string;
  vencimento: Date;
  codtipo: string;
}

interface ParcelaPostgreSQL {
  matricula: string;
  associado: string;
  convenio_codigo: string;
  convenio_nome: string;
  numeroVenda: string;
  num_parcela: number;
  qtd_parcelas: number;
  valor: string;
  status: string;
  vencimento: string;
  codTipo: number;
}

function formatarDataBR(data: Date): string {
  const d = new Date(data);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function gerarCSV(dados: any[], colunas: string[]): string {
  const linhas = [colunas.join(';')];
  
  for (const item of dados) {
    const valores = colunas.map(col => {
      const valor = item[col];
      if (valor === null || valor === undefined) return '';
      if (typeof valor === 'string') return `"${valor.replace(/"/g, '""')}"`;
      return String(valor);
    });
    linhas.push(valores.join(';'));
  }
  
  return linhas.join('\n');
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  GERADOR DE RELATÓRIOS - PENSIONISTAS');
  console.log('  Período: Março/2026');
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // ══════════════════════════════════════════════════════════════════
    // 1. RELATÓRIO MYSQL
    // ══════════════════════════════════════════════════════════════════
    console.log('📄 1. Gerando relatório MySQL...\n');

    const [parcelasMySQL] = await conn.execute(`
      SELECT 
        TRIM(p.matricula) as matricula,
        TRIM(p.associado) as associado,
        TRIM(p.codconven) as convenio_codigo,
        TRIM(p.conveniado) as convenio_nome,
        p.sequencia,
        CAST(p.nrseq AS UNSIGNED) as num_parcela,
        p.parcelas as qtd_parcelas,
        p.valor,
        TRIM(p.baixa) as status,
        p.vencimento,
        TRIM(s.codtipo) as codtipo
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026 
        AND MONTH(p.vencimento) = 3
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
        AND (s.codtipo = '3' OR s.codtipo = '4')
      ORDER BY p.matricula, p.codconven, p.nrseq
    `);

    const dadosMySQL = (parcelasMySQL as ParcelaMySQL[]).map(p => ({
      Matrícula: p.matricula,
      Associado: p.associado,
      'Cód Convênio': p.convenio_codigo,
      'Convênio': p.convenio_nome,
      'Sequência Venda': p.sequencia,
      'Nº Parcela': p.num_parcela,
      'Qtd Parcelas': p.qtd_parcelas,
      'Valor (R$)': parseFloat(p.valor).toFixed(2),
      'Status': p.status || 'EM ABERTO',
      'Vencimento': formatarDataBR(p.vencimento),
      'Tipo Sócio': p.codtipo === '3' ? 'Pensionista' : 'Dependente',
    }));

    console.log(`   Total de parcelas: ${dadosMySQL.length}`);
    const totalMySQL = dadosMySQL.reduce((sum, p) => sum + parseFloat(p['Valor (R$)']), 0);
    console.log(`   Valor total: R$ ${totalMySQL.toFixed(2)}`);

    const csvMySQL = gerarCSV(
      dadosMySQL,
      ['Matrícula', 'Associado', 'Cód Convênio', 'Convênio', 'Sequência Venda', 'Nº Parcela', 'Qtd Parcelas', 'Valor (R$)', 'Status', 'Vencimento', 'Tipo Sócio']
    );

    const arquivoMySQL = join(process.cwd(), 'RELATORIO_PENSIONISTAS_MYSQL.csv');
    writeFileSync(arquivoMySQL, '\uFEFF' + csvMySQL, 'utf8'); // BOM para Excel
    console.log(`   ✓ Salvo em: ${arquivoMySQL}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 2. RELATÓRIO POSTGRESQL
    // ══════════════════════════════════════════════════════════════════
    console.log('📄 2. Gerando relatório PostgreSQL...\n');

    const dataInicio = new Date(2026, 2, 1, 0, 0, 0);
    const dataFim = new Date(2026, 3, 0, 23, 59, 59);

    const parcelasPG = await prisma.parcela.findMany({
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
            codTipo: { in: [3, 4] }
          },
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
      orderBy: [
        { venda: { socio: { matricula: 'asc' } } },
        { numeroParcela: 'asc' },
      ],
    });

    const dadosPG: ParcelaPostgreSQL[] = parcelasPG.map(p => ({
      matricula: p.venda.socio.matricula || '',
      associado: p.venda.socio.nome || '',
      convenio_codigo: p.venda.convenio?.codigo || '',
      convenio_nome: p.venda.convenio?.razao_soc || '',
      numeroVenda: p.venda.numeroVenda,
      num_parcela: p.numeroParcela,
      qtd_parcelas: p.venda.quantidadeParcelas || 0,
      valor: String(p.valor),
      status: p.baixa || 'EM ABERTO',
      vencimento: formatarDataBR(p.dataVencimento),
      codTipo: p.venda.socio.codTipo,
    }));

    const dadosPGFormatados = dadosPG.map(p => ({
      Matrícula: p.matricula,
      Associado: p.associado,
      'Cód Convênio': p.convenio_codigo,
      'Convênio': p.convenio_nome,
      'Nº Venda': p.numeroVenda,
      'Nº Parcela': p.num_parcela,
      'Qtd Parcelas': p.qtd_parcelas,
      'Valor (R$)': parseFloat(p.valor).toFixed(2),
      'Status': p.status,
      'Vencimento': p.vencimento,
      'Tipo Sócio': p.codTipo === 3 ? 'Pensionista' : 'Dependente',
    }));

    console.log(`   Total de parcelas: ${dadosPGFormatados.length}`);
    const totalPG = dadosPGFormatados.reduce((sum, p) => sum + parseFloat(p['Valor (R$)']), 0);
    console.log(`   Valor total: R$ ${totalPG.toFixed(2)}`);

    const csvPG = gerarCSV(
      dadosPGFormatados,
      ['Matrícula', 'Associado', 'Cód Convênio', 'Convênio', 'Nº Venda', 'Nº Parcela', 'Qtd Parcelas', 'Valor (R$)', 'Status', 'Vencimento', 'Tipo Sócio']
    );

    const arquivoPG = join(process.cwd(), 'RELATORIO_PENSIONISTAS_POSTGRESQL.csv');
    writeFileSync(arquivoPG, '\uFEFF' + csvPG, 'utf8');
    console.log(`   ✓ Salvo em: ${arquivoPG}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 3. RELATÓRIO DE DIVERGÊNCIAS
    // ══════════════════════════════════════════════════════════════════
    console.log('📄 3. Gerando relatório de divergências...\n');

    // Matrículas no MySQL
    const matriculasMySQL = new Set(dadosMySQL.map(p => p.Matrícula));
    
    // Matrículas no PostgreSQL
    const matriculasPG = new Set(dadosPGFormatados.map(p => p.Matrícula));

    // Matrículas faltantes
    const matriculasFaltantes: string[] = [];
    for (const mat of matriculasMySQL) {
      if (!matriculasPG.has(mat)) {
        matriculasFaltantes.push(mat);
      }
    }

    // Buscar dados dos sócios faltantes
    const [sociosFaltantes] = await conn.execute(`
      SELECT 
        TRIM(s.matricula) as matricula,
        TRIM(s.associado) as nome,
        TRIM(s.codtipo) as codtipo,
        COUNT(p.nrseq) as qtd_parcelas,
        SUM(p.valor) as total_parcelas
      FROM socios s
      LEFT JOIN parcelas p ON TRIM(s.matricula) = TRIM(p.matricula)
        AND YEAR(p.vencimento) = 2026 
        AND MONTH(p.vencimento) = 3
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
      WHERE TRIM(s.matricula) IN (${matriculasFaltantes.map(m => `'${m}'`).join(',')})
        AND (s.codtipo = '3' OR s.codtipo = '4')
      GROUP BY s.matricula, s.associado, s.codtipo
      ORDER BY total_parcelas DESC
    `);

    const divergencias = (sociosFaltantes as any[]).map(s => ({
      Matrícula: s.matricula,
      Nome: s.nome,
      'Tipo Sócio': s.codtipo === '3' ? 'Pensionista' : 'Dependente',
      'Qtd Parcelas Mar/2026': s.qtd_parcelas,
      'Valor Total (R$)': parseFloat(s.total_parcelas || 0).toFixed(2),
    }));

    console.log(`   Sócios faltantes: ${divergencias.length}`);
    const totalDivergencias = divergencias.reduce((sum, d) => sum + parseFloat(d['Valor Total (R$)']), 0);
    console.log(`   Valor não migrado: R$ ${totalDivergencias.toFixed(2)}`);

    const csvDivergencias = gerarCSV(
      divergencias,
      ['Matrícula', 'Nome', 'Tipo Sócio', 'Qtd Parcelas Mar/2026', 'Valor Total (R$)']
    );

    const arquivoDivergencias = join(process.cwd(), 'RELATORIO_PENSIONISTAS_FALTANTES.csv');
    writeFileSync(arquivoDivergencias, '\uFEFF' + csvDivergencias, 'utf8');
    console.log(`   ✓ Salvo em: ${arquivoDivergencias}\n`);

    // ══════════════════════════════════════════════════════════════════
    // 4. RESUMO FINAL
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  RESUMO DOS RELATÓRIOS GERADOS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 MYSQL (Legado):');
    console.log(`   └─ ${dadosMySQL.length} parcelas`);
    console.log(`   └─ ${matriculasMySQL.size} matrículas`);
    console.log(`   └─ R$ ${totalMySQL.toFixed(2)}\n`);

    console.log('📊 POSTGRESQL (Railway):');
    console.log(`   └─ ${dadosPGFormatados.length} parcelas`);
    console.log(`   └─ ${matriculasPG.size} matrículas`);
    console.log(`   └─ R$ ${totalPG.toFixed(2)}\n`);

    console.log('⚠️  DIVERGÊNCIAS:');
    console.log(`   └─ ${divergencias.length} sócios não migrados`);
    console.log(`   └─ ${dadosMySQL.length - dadosPGFormatados.length} parcelas faltantes`);
    console.log(`   └─ R$ ${totalDivergencias.toFixed(2)} não migrado\n`);

    console.log('📁 ARQUIVOS GERADOS:');
    console.log(`   1. ${arquivoMySQL}`);
    console.log(`   2. ${arquivoPG}`);
    console.log(`   3. ${arquivoDivergencias}\n`);

  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✓ Relatórios gerados com sucesso!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

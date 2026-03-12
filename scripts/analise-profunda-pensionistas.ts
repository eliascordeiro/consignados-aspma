/**
 * ANÁLISE PROFUNDA: Débitos de Pensionistas
 * MySQL (Legado) vs PostgreSQL (Railway)
 * 
 * Identifica exatamente quais vendas/parcelas o Railway não reconheceu
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
  codconven: string;
  conveniado: string;
  sequencia: string;
  nrseq: string;
  parcelas: number;
  valor: number;
  baixa: string;
  vencimento: Date;
  codtipo: string;
}

interface ParcelaPG {
  matricula: string;
  nome: string;
  numeroVenda: string;
  numeroParcela: number;
  quantidadeParcelas: number;
  valor: number;
  baixa: string | null;
  dataVencimento: Date;
  codTipo: number;
  convenio_codigo: string;
  convenio_nome: string;
}

function criarChaveVenda(matricula: string, sequencia: string, codconven: string): string {
  return `${matricula.trim()}-${sequencia.trim()}-${codconven.trim()}`;
}

function criarChaveParcela(matricula: string, sequencia: string, nrseq: string): string {
  return `${matricula.trim()}-${sequencia.trim()}-${nrseq.trim()}`;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ANÁLISE PROFUNDA: DÉBITOS DE PENSIONISTAS');
  console.log('  MySQL (Legado) vs PostgreSQL (Railway)');
  console.log('  Período: Março/2026');
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // ══════════════════════════════════════════════════════════════════
    // 1. BUSCAR PARCELAS DO MYSQL (AS302.PRG)
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 Consultando MySQL (AS302.PRG)...\n');

    const [parcelasMySQL] = await conn.execute(`
      SELECT 
        TRIM(p.matricula) as matricula,
        TRIM(p.associado) as associado,
        TRIM(p.codconven) as codconven,
        TRIM(p.conveniado) as conveniado,
        TRIM(p.sequencia) as sequencia,
        TRIM(p.nrseq) as nrseq,
        p.parcelas,
        p.valor,
        TRIM(p.baixa) as baixa,
        p.vencimento,
        TRIM(s.codtipo) as codtipo
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026 
        AND MONTH(p.vencimento) = 3
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
        AND (s.codtipo = '3' OR s.codtipo = '4')
      ORDER BY p.associado, p.matricula, p.sequencia, p.nrseq
    `);

    const mysqlData = parcelasMySQL as ParcelaMySQL[];
    console.log(`✓ MySQL: ${mysqlData.length} parcelas encontradas\n`);

    // ══════════════════════════════════════════════════════════════════
    // 2. BUSCAR PARCELAS DO POSTGRESQL
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 Consultando PostgreSQL (Railway)...\n');

    const dataInicio = new Date(2026, 2, 1, 0, 0, 0);
    const dataFim = new Date(2026, 3, 0, 23, 59, 59, 999);

    const parcelasPG = await prisma.parcela.findMany({
      where: {
        dataVencimento: {
          gte: dataInicio,
          lte: dataFim,
        },
        OR: [
          { baixa: null },
          { baixa: '' },
          { baixa: ' ' },
          { baixa: 'N' },
        ],
        venda: {
          socio: {
            codTipo: { in: [3, 4] },
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
        { venda: { socio: { nome: 'asc' } } },
        { venda: { socio: { matricula: 'asc' } } },
        { venda: { numeroVenda: 'asc' } },
        { numeroParcela: 'asc' },
      ],
    });

    const pgData: ParcelaPG[] = parcelasPG.map(p => ({
      matricula: p.venda.socio.matricula || '',
      nome: p.venda.socio.nome || '',
      numeroVenda: p.venda.numeroVenda,
      numeroParcela: p.numeroParcela,
      quantidadeParcelas: p.venda.quantidadeParcelas || 0,
      valor: parseFloat(String(p.valor)),
      baixa: p.baixa,
      dataVencimento: p.dataVencimento,
      codTipo: p.venda.socio.codTipo,
      convenio_codigo: p.venda.convenio?.codigo || '',
      convenio_nome: p.venda.convenio?.razao_soc || '',
    }));

    console.log(`✓ PostgreSQL: ${pgData.length} parcelas encontradas\n`);

    // ══════════════════════════════════════════════════════════════════
    // 3. CRIAR MAPAS DE COMPARAÇÃO
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 Criando mapas de comparação...\n');

    // Mapa de parcelas do MySQL por chave única
    const mysqlParcelas = new Map<string, ParcelaMySQL>();
    const mysqlVendas = new Map<string, ParcelaMySQL[]>();
    const mysqlMatriculas = new Map<string, ParcelaMySQL[]>();

    for (const p of mysqlData) {
      const chaveParcela = criarChaveParcela(p.matricula, p.sequencia, p.nrseq);
      const chaveVenda = criarChaveVenda(p.matricula, p.sequencia, p.codconven);
      
      mysqlParcelas.set(chaveParcela, p);
      
      if (!mysqlVendas.has(chaveVenda)) {
        mysqlVendas.set(chaveVenda, []);
      }
      mysqlVendas.get(chaveVenda)!.push(p);

      if (!mysqlMatriculas.has(p.matricula)) {
        mysqlMatriculas.set(p.matricula, []);
      }
      mysqlMatriculas.get(p.matricula)!.push(p);
    }

    // Mapa de parcelas do PostgreSQL
    const pgMatriculas = new Map<string, ParcelaPG[]>();
    
    for (const p of pgData) {
      if (!pgMatriculas.has(p.matricula)) {
        pgMatriculas.set(p.matricula, []);
      }
      pgMatriculas.get(p.matricula)!.push(p);
    }

    console.log(`✓ MySQL: ${mysqlMatriculas.size} matrículas únicas`);
    console.log(`✓ MySQL: ${mysqlVendas.size} vendas únicas`);
    console.log(`✓ PostgreSQL: ${pgMatriculas.size} matrículas únicas\n`);

    // ══════════════════════════════════════════════════════════════════
    // 4. IDENTIFICAR MATRÍCULAS FALTANTES
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  MATRÍCULAS FALTANTES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const matriculasFaltantes: Array<{
      matricula: string;
      nome: string;
      codTipo: string;
      qtdParcelas: number;
      valorTotal: number;
      vendas: string[];
    }> = [];

    for (const [matricula, parcelas] of mysqlMatriculas.entries()) {
      if (!pgMatriculas.has(matricula)) {
        const valorTotal = parcelas.reduce((sum, p) => sum + p.valor, 0);
        const vendasUnicas = new Set(parcelas.map(p => criarChaveVenda(p.matricula, p.sequencia, p.codconven)));
        
        matriculasFaltantes.push({
          matricula,
          nome: parcelas[0].associado,
          codTipo: parcelas[0].codtipo,
          qtdParcelas: parcelas.length,
          valorTotal,
          vendas: Array.from(vendasUnicas),
        });
      }
    }

    matriculasFaltantes.sort((a, b) => b.valorTotal - a.valorTotal);

    console.log(`Total de matrículas faltantes: ${matriculasFaltantes.length}\n`);

    if (matriculasFaltantes.length > 0) {
      console.log('Top 20 matrículas com maior impacto:\n');
      
      matriculasFaltantes.slice(0, 20).forEach((m, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. Mat: ${m.matricula.padEnd(10)} | ` +
          `${m.nome.substring(0, 35).padEnd(35)} | ` +
          `Tipo ${m.codTipo} | ` +
          `${m.qtdParcelas.toString().padStart(3)} parcelas | ` +
          `R$ ${m.valorTotal.toFixed(2).padStart(10)} | ` +
          `${m.vendas.length} venda(s)`);
      });

      const totalPerdido = matriculasFaltantes.reduce((sum, m) => sum + m.valorTotal, 0);
      const parcelasPerdidas = matriculasFaltantes.reduce((sum, m) => sum + m.qtdParcelas, 0);
      
      console.log(`\n💰 Total não migrado: R$ ${totalPerdido.toFixed(2)}`);
      console.log(`📊 Parcelas não migradas: ${parcelasPerdidas}`);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. MATRÍCULAS MIGRADAS COM PARCELAS FALTANTES
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  MATRÍCULAS MIGRADAS COM PARCELAS FALTANTES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const matriculasComParcialFalta: Array<{
      matricula: string;
      nome: string;
      parcelasMySQL: number;
      parcelasPG: number;
      parcelasFaltando: number;
      valorFaltando: number;
    }> = [];

    for (const [matricula, parcelasMySQL] of mysqlMatriculas.entries()) {
      const parcelasPG = pgMatriculas.get(matricula);
      
      if (parcelasPG && parcelasPG.length < parcelasMySQL.length) {
        const valorMySQL = parcelasMySQL.reduce((sum, p) => sum + p.valor, 0);
        const valorPG = parcelasPG.reduce((sum, p) => sum + p.valor, 0);
        
        matriculasComParcialFalta.push({
          matricula,
          nome: parcelasMySQL[0].associado,
          parcelasMySQL: parcelasMySQL.length,
          parcelasPG: parcelasPG.length,
          parcelasFaltando: parcelasMySQL.length - parcelasPG.length,
          valorFaltando: valorMySQL - valorPG,
        });
      }
    }

    matriculasComParcialFalta.sort((a, b) => b.valorFaltando - a.valorFaltando);

    console.log(`Total: ${matriculasComParcialFalta.length} matrículas com parcelas parcialmente migradas\n`);

    if (matriculasComParcialFalta.length > 0) {
      console.log('Top 20 casos:\n');
      
      matriculasComParcialFalta.slice(0, 20).forEach((m, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. Mat: ${m.matricula.padEnd(10)} | ` +
          `${m.nome.substring(0, 35).padEnd(35)} | ` +
          `MySQL: ${m.parcelasMySQL.toString().padStart(3)} | ` +
          `PG: ${m.parcelasPG.toString().padStart(3)} | ` +
          `Faltam: ${m.parcelasFaltando.toString().padStart(3)} | ` +
          `R$ ${m.valorFaltando.toFixed(2).padStart(10)}`);
      });

      const totalParcialPerdido = matriculasComParcialFalta.reduce((sum, m) => sum + m.valorFaltando, 0);
      console.log(`\n💰 Total parcialmente não migrado: R$ ${totalParcialPerdido.toFixed(2)}`);
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. VENDAS NÃO RECONHECIDAS
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ANÁLISE POR VENDA');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Buscar todas as vendas do PostgreSQL para comparação
    const vendasPG = await prisma.venda.findMany({
      where: {
        socio: {
          codTipo: { in: [3, 4] },
        },
        parcelas: {
          some: {
            dataVencimento: {
              gte: dataInicio,
              lte: dataFim,
            },
          },
        },
      },
      include: {
        socio: {
          select: {
            matricula: true,
            nome: true,
          },
        },
        convenio: {
          select: {
            codigo: true,
          },
        },
        parcelas: {
          where: {
            dataVencimento: {
              gte: dataInicio,
              lte: dataFim,
            },
          },
        },
      },
    });

    console.log(`PostgreSQL: ${vendasPG.length} vendas com parcelas em março/2026\n`);
    console.log(`MySQL: ${mysqlVendas.size} vendas com parcelas em março/2026\n`);

    // Criar mapa de vendas PostgreSQL por matrícula
    const vendasPGPorMatricula = new Map<string, typeof vendasPG>();
    for (const venda of vendasPG) {
      const mat = venda.socio.matricula || '';
      if (!vendasPGPorMatricula.has(mat)) {
        vendasPGPorMatricula.set(mat, []);
      }
      vendasPGPorMatricula.get(mat)!.push(venda);
    }

    // ══════════════════════════════════════════════════════════════════
    // 7. RESUMO FINAL
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  RESUMO FINAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    const totalMySQLValor = mysqlData.reduce((sum, p) => sum + p.valor, 0);
    const totalPGValor = pgData.reduce((sum, p) => sum + p.valor, 0);
    const diferencaValor = totalMySQLValor - totalPGValor;
    const percentualMigrado = (totalPGValor / totalMySQLValor) * 100;

    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│ PARCELAS                                                 │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log(`│ MySQL (Legado):      ${mysqlData.length.toString().padStart(5)} parcelas - R$ ${totalMySQLValor.toFixed(2).padStart(12)}  │`);
    console.log(`│ PostgreSQL (Railway): ${pgData.length.toString().padStart(5)} parcelas - R$ ${totalPGValor.toFixed(2).padStart(12)}  │`);
    console.log(`│ Diferença:           ${(mysqlData.length - pgData.length).toString().padStart(5)} parcelas - R$ ${diferencaValor.toFixed(2).padStart(12)}  │`);
    console.log(`│ Percentual migrado:  ${percentualMigrado.toFixed(1)}%                                    │`);
    console.log('└──────────────────────────────────────────────────────────┘\n');

    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│ PROBLEMA PRINCIPAL                                       │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log(`│ ${matriculasFaltantes.length} matrículas não migradas (100% das parcelas)     │`);
    console.log(`│ ${matriculasComParcialFalta.length} matrículas com migração parcial                   │`);
    console.log('└──────────────────────────────────────────────────────────┘\n');

    // ══════════════════════════════════════════════════════════════════
    // 8. GERAR ARQUIVOS CSV DE ANÁLISE
    // ══════════════════════════════════════════════════════════════════
    console.log('📁 Gerando arquivos de análise...\n');

    // CSV de matrículas faltantes
    const csvMatriculasFaltantes = [
      'Matrícula;Nome;Tipo;QtdParcelas;ValorTotal;QtdVendas',
      ...matriculasFaltantes.map(m => 
        `${m.matricula};${m.nome};${m.codTipo};${m.qtdParcelas};${m.valorTotal.toFixed(2)};${m.vendas.length}`
      )
    ].join('\n');

    writeFileSync(
      join(process.cwd(), 'ANALISE_MATRICULAS_FALTANTES.csv'),
      '\uFEFF' + csvMatriculasFaltantes,
      'utf8'
    );

    // CSV de matrículas com parcelas parciais
    const csvParciais = [
      'Matrícula;Nome;ParcelasMySQL;ParcelasPG;ParcelasFaltando;ValorFaltando',
      ...matriculasComParcialFalta.map(m =>
        `${m.matricula};${m.nome};${m.parcelasMySQL};${m.parcelasPG};${m.parcelasFaltando};${m.valorFaltando.toFixed(2)}`
      )
    ].join('\n');

    writeFileSync(
      join(process.cwd(), 'ANALISE_PARCELAS_PARCIAIS.csv'),
      '\uFEFF' + csvParciais,
      'utf8'
    );

    console.log('✓ ANALISE_MATRICULAS_FALTANTES.csv');
    console.log('✓ ANALISE_PARCELAS_PARCIAIS.csv\n');

  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('✓ Análise concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  });

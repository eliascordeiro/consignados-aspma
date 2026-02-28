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

interface ParcelaMySQLRow {
  matricula: string;
  associado: string;
  codtipo: string;
  codconven: string;
  conveniado: string;
  nrseq: string;
  parcelas: number;
  sequencia: number;
  valor: number;
  vencimento: Date;
}

interface ParcelaPGRow {
  id: string;
  numeroParcela: number;
  valor: number;
  dataVencimento: Date;
  matricula: string | null;
  nome: string;
  codTipo: number | null;
  convenioId: number | null;
  convenioNome: string;
  numeroVenda: number;
  quantidadeParcelas: number;
}

async function compararPensionistas() {
  console.log('\n=== COMPARAÇÃO: Pensionistas Fevereiro/2026 ===\n');
  console.log('🔍 MySQL (LEGADO) vs PostgreSQL (ATUAL)\n');

  // Conectar ao MySQL
  const mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // 1. Buscar parcelas do MySQL (AS302.PRG)
    console.log('📊 Buscando dados do MySQL LEGADO...');
    const [mysqlRows] = await mysqlConnection.execute(`
      SELECT 
        p.matricula,
        p.associado,
        s.codtipo,
        p.codconven,
        p.conveniado,
        p.nrseq,
        p.parcelas,
        p.sequencia,
        p.valor,
        p.vencimento
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026
        AND MONTH(p.vencimento) = 2
        AND TRIM(p.baixa) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
      ORDER BY p.associado, p.matricula, p.sequencia, p.nrseq
    `);

    const parcelasMysql = mysqlRows as ParcelaMySQLRow[];
    console.log(`✅ MySQL: ${parcelasMysql.length} parcelas encontradas\n`);

    // 2. Buscar parcelas do PostgreSQL
    console.log('📊 Buscando dados do PostgreSQL ATUAL...');
    
    const dataInicio = new Date(2026, 1, 1, 0, 0, 0); // 01/02/2026
    const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999); // 28/02/2026
    
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
          { baixa: 'N' }, // PostgreSQL migrado: 'N' = não baixada
        ],
        venda: {
          socio: {
            codTipo: { in: [3, 4] }
          }
        }
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
                id: true,
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

    console.log(`✅ PostgreSQL: ${parcelasPG.length} parcelas encontradas\n`);

    // 3. Calcular totais
    const totalMysql = parcelasMysql.reduce((sum, p) => sum + Number(p.valor), 0);
    const totalPG = parcelasPG.reduce((sum, p) => sum + Number(p.valor), 0);
    const diferenca = totalMysql - totalPG;

    console.log('💰 TOTAIS:');
    console.log(`   MySQL:      R$ ${totalMysql.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`);
    console.log(`   PostgreSQL: R$ ${totalPG.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`);
    console.log(`   Diferença:  R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ${diferenca > 0 ? '(MySQL > PG)' : '(PG > MySQL)'}\n`);

    // 4. Criar mapa de parcelas do PostgreSQL para comparação rápida
    const parcelasPGMap = new Map<string, ParcelaPGRow>();
    
    for (const p of parcelasPG) {
      const key = `${p.venda.socio.matricula?.trim() || 'SEM_MAT'}_${p.venda.numeroVenda}_${p.numeroParcela}`;
      parcelasPGMap.set(key, {
        id: p.id,
        numeroParcela: p.numeroParcela,
        valor: Number(p.valor),
        dataVencimento: p.dataVencimento,
        matricula: p.venda.socio.matricula,
        nome: p.venda.socio.nome,
        codTipo: p.venda.socio.codTipo,
        convenioId: p.venda.convenio?.id || null,
        convenioNome: p.venda.convenio?.razao_soc || 'SEM CONVÊNIO',
        numeroVenda: p.venda.numeroVenda,
        quantidadeParcelas: p.venda.quantidadeParcelas,
      });
    }

    // 5. Identificar parcelas que estão no MySQL mas NÃO no PostgreSQL
    console.log('🔍 PARCELAS QUE ESTÃO NO MYSQL MAS NÃO NO POSTGRESQL:\n');
    
    const parcelasFaltando: Array<{mysql: ParcelaMySQLRow, diferenca: number}> = [];
    
    for (const mysqlParcela of parcelasMysql) {
      const key = `${mysqlParcela.matricula.trim()}_${mysqlParcela.sequencia}_${mysqlParcela.nrseq}`;
      
      if (!parcelasPGMap.has(key)) {
        parcelasFaltando.push({
          mysql: mysqlParcela,
          diferenca: Number(mysqlParcela.valor)
        });
      }
    }

    if (parcelasFaltando.length > 0) {
      console.log(`⚠️  ${parcelasFaltando.length} parcelas encontradas APENAS no MySQL:\n`);
      
      let totalFaltando = 0;
      for (const item of parcelasFaltando) {
        const p = item.mysql;
        totalFaltando += item.diferenca;
        
        console.log(`   📌 Matrícula: ${p.matricula.trim().padEnd(10)} | Sócio: ${p.associado.substring(0, 30).padEnd(30)}`);
        console.log(`      Convênio: ${p.codconven.trim().padEnd(6)} - ${p.conveniado.substring(0, 30)}`);
        console.log(`      Parcela: ${p.nrseq.padStart(2, '0')}/${p.parcelas.toString().padStart(2, '0')} | Seq: ${p.sequencia} | Valor: R$ ${Number(p.valor).toFixed(2)}`);
        console.log(`      Vencimento: ${new Date(p.vencimento).toLocaleDateString('pt-BR')} | CodTipo: ${p.codtipo}\n`);
      }
      
      console.log(`   💵 Total das parcelas faltando: R$ ${totalFaltando.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}\n`);
    } else {
      console.log('✅ Nenhuma parcela faltando no PostgreSQL\n');
    }

    // 6. Identificar parcelas que estão no PostgreSQL mas NÃO no MySQL
    console.log('🔍 PARCELAS QUE ESTÃO NO POSTGRESQL MAS NÃO NO MYSQL:\n');
    
    const mysqlMap = new Map<string, ParcelaMySQLRow>();
    for (const p of parcelasMysql) {
      const key = `${p.matricula.trim()}_${p.sequencia}_${p.nrseq}`;
      mysqlMap.set(key, p);
    }
    
    const parcelasExtras: Array<{pg: ParcelaPGRow, diferenca: number}> = [];
    
    for (const [key, pgParcela] of parcelasPGMap.entries()) {
      const mysqlKey = `${pgParcela.matricula?.trim() || 'SEM_MAT'}_${pgParcela.numeroVenda}_${pgParcela.numeroParcela}`;
      
      if (!mysqlMap.has(mysqlKey)) {
        parcelasExtras.push({
          pg: pgParcela,
          diferenca: Number(pgParcela.valor)
        });
      }
    }

    if (parcelasExtras.length > 0) {
      console.log(`⚠️  ${parcelasExtras.length} parcelas encontradas APENAS no PostgreSQL:\n`);
      
      let totalExtras = 0;
      for (const item of parcelasExtras) {
        const p = item.pg;
        totalExtras += item.diferenca;
        
        console.log(`   📌 Matrícula: ${(p.matricula?.trim() || 'SEM_MAT').padEnd(10)} | Sócio: ${p.nome.substring(0, 30).padEnd(30)}`);
        console.log(`      Convênio: ${p.convenioNome.substring(0, 30)}`);
        console.log(`      Parcela: ${p.numeroParcela.toString().padStart(2, '0')}/${p.quantidadeParcelas.toString().padStart(2, '0')} | Venda: ${p.numeroVenda} | Valor: R$ ${p.valor.toFixed(2)}`);
        console.log(`      Vencimento: ${p.dataVencimento.toLocaleDateString('pt-BR')} | CodTipo: ${p.codTipo || 'NULL'}\n`);
      }
      
      console.log(`   💵 Total das parcelas extras: R$ ${totalExtras.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}\n`);
    } else {
      console.log('✅ Nenhuma parcela extra no PostgreSQL\n');
    }

    // 7. Comparar valores de parcelas correspondentes
    console.log('🔍 PARCELAS COM DIFERENÇA DE VALOR:\n');
    
    const diferencasValor: Array<{mysql: ParcelaMySQLRow, pg: ParcelaPGRow, diff: number}> = [];
    
    for (const mysqlParcela of parcelasMysql) {
      const key = `${mysqlParcela.matricula.trim()}_${mysqlParcela.sequencia}_${mysqlParcela.nrseq}`;
      const pgParcela = parcelasPGMap.get(key);
      
      if (pgParcela) {
        const mysqlValor = Number(mysqlParcela.valor);
        const pgValor = Number(pgParcela.valor);
        const diff = Math.abs(mysqlValor - pgValor);
        
        if (diff > 0.01) { // Diferença maior que 1 centavo
          diferencasValor.push({ mysql: mysqlParcela, pg: pgParcela, diff });
        }
      }
    }

    if (diferencasValor.length > 0) {
      console.log(`⚠️  ${diferencasValor.length} parcelas com diferença de valor:\n`);
      
      for (const item of diferencasValor) {
        console.log(`   📌 Matrícula: ${item.mysql.matricula.trim()} | ${item.mysql.associado.substring(0, 30)}`);
        console.log(`      MySQL:      R$ ${Number(item.mysql.valor).toFixed(2)}`);
        console.log(`      PostgreSQL: R$ ${item.pg.valor.toFixed(2)}`);
        console.log(`      Diferença:  R$ ${item.diff.toFixed(2)}\n`);
      }
    } else {
      console.log('✅ Nenhuma diferença de valor encontrada nas parcelas correspondentes\n');
    }

    // 8. Resumo final
    console.log('=' .repeat(80));
    console.log('📋 RESUMO DA COMPARAÇÃO:\n');
    console.log(`   Total de parcelas MySQL:      ${parcelasMysql.length}`);
    console.log(`   Total de parcelas PostgreSQL: ${parcelasPG.length}`);
    console.log(`   Diferença de registros:       ${Math.abs(parcelasMysql.length - parcelasPG.length)}\n`);
    console.log(`   Total MySQL:      R$ ${totalMysql.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`);
    console.log(`   Total PostgreSQL: R$ ${totalPG.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`);
    console.log(`   Diferença:        R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}\n`);
    console.log('=' .repeat(80));

  } finally {
    await mysqlConnection.end();
    await prisma.$disconnect();
  }
}

compararPensionistas()
  .then(() => {
    console.log('\n✅ Comparação concluída com sucesso!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro na comparação:', error);
    process.exit(1);
  });

/**
 * DIAGNÓSTICO DE INCONSISTÊNCIAS - PENSIONISTAS (Mar/2026)
 * 
 * Verifica problemas nos dados do MySQL legado que podem impedir migração:
 * 1. Parcelas sem venda correspondente na tabela vendas
 * 2. Parcelas com matrícula que não existe em socios
 * 3. Vendas sem sócio correspondente
 * 4. Diferenças entre TRIM() e sem TRIM()
 * 
 * Foco: Apenas pensionistas (codtipo 3 e 4) do período 03/2026
 */

import mysql from 'mysql2/promise';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '200.98.112.240',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

interface DiagnosticoResult {
  categoria: string;
  problema: string;
  quantidade: number;
  exemplos: any[];
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DIAGNÓSTICO DE INCONSISTÊNCIAS - PENSIONISTAS');
  console.log('  Período: Março/2026');
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);
  const diagnosticos: DiagnosticoResult[] = [];

  try {
    // ══════════════════════════════════════════════════════════════════
    // 1. PARCELAS DE PENSIONISTAS SEM VENDA CORRESPONDENTE
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 1. Verificando parcelas sem venda na tabela vendas...');
    
    const [parcelasSemVenda] = await conn.execute(`
      SELECT 
        p.matricula,
        p.sequencia,
        p.nrseq,
        TRIM(p.associado) as associado,
        p.vencimento,
        p.valor,
        s.codtipo
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      LEFT JOIN vendas v ON TRIM(p.matricula) = TRIM(v.matricula) AND p.sequencia = v.sequencia
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
        AND v.sequencia IS NULL
      LIMIT 10
    `);

    const [countParcelasSemVenda] = await conn.execute(`
      SELECT COUNT(*) as total
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      LEFT JOIN vendas v ON TRIM(p.matricula) = TRIM(v.matricula) AND p.sequencia = v.sequencia
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
        AND v.sequencia IS NULL
    `) as any;

    diagnosticos.push({
      categoria: 'PARCELAS SEM VENDA',
      problema: 'Parcelas que não têm registro correspondente na tabela vendas',
      quantidade: countParcelasSemVenda[0].total,
      exemplos: parcelasSemVenda as any[]
    });

    // ══════════════════════════════════════════════════════════════════
    // 2. PARCELAS COM MATRÍCULA QUE NÃO EXISTE EM SOCIOS
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 2. Verificando parcelas com matrícula sem sócio...');
    
    const [parcelasSemSocio] = await conn.execute(`
      SELECT 
        p.matricula,
        p.sequencia,
        p.nrseq,
        TRIM(p.associado) as associado,
        p.vencimento,
        p.valor
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND s.matricula IS NULL
      LIMIT 10
    `);

    const [countParcelasSemSocio] = await conn.execute(`
      SELECT COUNT(*) as total
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND s.matricula IS NULL
    `) as any;

    diagnosticos.push({
      categoria: 'PARCELAS SEM SÓCIO',
      problema: 'Parcelas com matrícula que não existe na tabela socios',
      quantidade: countParcelasSemSocio[0].total,
      exemplos: parcelasSemSocio as any[]
    });

    // ══════════════════════════════════════════════════════════════════
    // 3. VENDAS DE PENSIONISTAS SEM SÓCIO
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 3. Verificando vendas sem sócio correspondente...');
    
    const [vendasSemSocio] = await conn.execute(`
      SELECT 
        v.matricula,
        v.sequencia,
        v.emissao,
        v.parcelas,
        v.valorparcela
      FROM vendas v
      LEFT JOIN socios s ON TRIM(v.matricula) = TRIM(s.matricula)
      WHERE s.matricula IS NULL
        AND v.parcelas > 0
      LIMIT 10
    `);

    const [countVendasSemSocio] = await conn.execute(`
      SELECT COUNT(*) as total
      FROM vendas v
      LEFT JOIN socios s ON TRIM(v.matricula) = TRIM(s.matricula)
      WHERE s.matricula IS NULL
        AND v.parcelas > 0
    `) as any;

    diagnosticos.push({
      categoria: 'VENDAS SEM SÓCIO',
      problema: 'Vendas com matrícula que não existe na tabela socios',
      quantidade: countVendasSemSocio[0].total,
      exemplos: vendasSemSocio as any[]
    });

    // ══════════════════════════════════════════════════════════════════
    // 4. PARCELAS DE PENSIONISTAS COM VENDA MAS VENDA NÃO É DE PENSIONISTA
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 4. Verificando divergência de tipo entre parcela e venda...');
    
    const [divergenciaTipo] = await conn.execute(`
      SELECT 
        p.matricula,
        p.sequencia,
        TRIM(p.associado) as associado,
        s.codtipo as tipo_na_tabela_socios,
        COUNT(*) as qtd_parcelas
      FROM parcelas p
      INNER JOIN vendas v ON TRIM(p.matricula) = TRIM(v.matricula) AND p.sequencia = v.sequencia
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
      GROUP BY p.matricula, p.sequencia, p.associado, s.codtipo
      LIMIT 10
    `);

    diagnosticos.push({
      categoria: 'VENDAS DE PENSIONISTAS VÁLIDAS',
      problema: 'Parcelas que TÊM venda correspondente e sócio pensionista',
      quantidade: (divergenciaTipo as any[]).length,
      exemplos: divergenciaTipo as any[]
    });

    // ══════════════════════════════════════════════════════════════════
    // 5. TOTAL DE PARCELAS DE PENSIONISTAS (REFERÊNCIA AS302.PRG)
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 5. Total de parcelas conforme AS302.PRG...');
    
    const [totalAS302] = await conn.execute(`
      SELECT COUNT(*) as total, SUM(p.valor) as valor_total
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
    `) as any;

    diagnosticos.push({
      categoria: 'TOTAL AS302.PRG',
      problema: 'Total de parcelas conforme query original do programa AS302.PRG',
      quantidade: totalAS302[0].total,
      exemplos: [totalAS302[0]]
    });

    // ══════════════════════════════════════════════════════════════════
    // 6. PARCELAS QUE DEVERIAM SER MIGRADAS (COM VENDA + SOCIO)
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 6. Parcelas que DEVERIAM ser migradas...');
    
    const [parcelasMigraveis] = await conn.execute(`
      SELECT COUNT(*) as total, SUM(p.valor) as valor_total
      FROM parcelas p
      INNER JOIN vendas v ON TRIM(p.matricula) = TRIM(v.matricula) AND p.sequencia = v.sequencia
      INNER JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
    `) as any;

    diagnosticos.push({
      categoria: 'PARCELAS MIGRÁVEIS',
      problema: 'Parcelas que têm venda E sócio (podem ser migradas)',
      quantidade: parcelasMigraveis[0].total,
      exemplos: [parcelasMigraveis[0]]
    });

    // ══════════════════════════════════════════════════════════════════
    // 7. ANÁLISE DE MATRÍCULAS - COM/SEM TRIM
    // ══════════════════════════════════════════════════════════════════
    console.log('🔍 7. Verificando diferenças com/sem TRIM em matrículas...');
    
    const [matriculasComEspacos] = await conn.execute(`
      SELECT 
        p.matricula as matricula_com_espacos,
        TRIM(p.matricula) as matricula_trim,
        LENGTH(p.matricula) as tamanho_original,
        LENGTH(TRIM(p.matricula)) as tamanho_trim,
        COUNT(*) as qtd_parcelas
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE MONTH(p.vencimento) = 3
        AND YEAR(p.vencimento) = 2026
        AND TRIM(COALESCE(p.baixa, '')) = ''
        AND (s.codtipo = '3' OR s.codtipo = '4')
        AND LENGTH(p.matricula) != LENGTH(TRIM(p.matricula))
      GROUP BY p.matricula
      LIMIT 10
    `);

    diagnosticos.push({
      categoria: 'MATRÍCULAS COM ESPAÇOS',
      problema: 'Matrículas que têm espaços em branco (precisam de TRIM)',
      quantidade: (matriculasComEspacos as any[]).length,
      exemplos: matriculasComEspacos as any[]
    });

    // ══════════════════════════════════════════════════════════════════
    // EXIBIR RESULTADOS
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  RESULTADOS DO DIAGNÓSTICO');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const diag of diagnosticos) {
      console.log(`\n┌─────────────────────────────────────────────────────────┐`);
      console.log(`│ ${diag.categoria.padEnd(55)} │`);
      console.log(`├─────────────────────────────────────────────────────────┤`);
      console.log(`│ Problema: ${diag.problema.substring(0, 44).padEnd(44)} │`);
      console.log(`│ Quantidade: ${String(diag.quantidade).padStart(10)} registros             │`);
      console.log(`└─────────────────────────────────────────────────────────┘`);

      if (diag.exemplos.length > 0) {
        console.log('\nExemplos:');
        console.log(JSON.stringify(diag.exemplos.slice(0, 3), null, 2));
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // ANÁLISE FINAL
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ANÁLISE FINAL');
    console.log('═══════════════════════════════════════════════════════════\n');

    const totalAS302Qtd = diagnosticos.find(d => d.categoria === 'TOTAL AS302.PRG')?.quantidade || 0;
    const parcelasSemVendaQtd = diagnosticos.find(d => d.categoria === 'PARCELAS SEM VENDA')?.quantidade || 0;
    const parcelasSemSocioQtd = diagnosticos.find(d => d.categoria === 'PARCELAS SEM SÓCIO')?.quantidade || 0;
    const parcelasMigraveisQtd = diagnosticos.find(d => d.categoria === 'PARCELAS MIGRÁVEIS')?.quantidade || 0;

    console.log(`Total de parcelas no AS302.PRG:        ${totalAS302Qtd}`);
    console.log(`Parcelas sem venda correspondente:     ${parcelasSemVendaQtd} (${((parcelasSemVendaQtd/totalAS302Qtd)*100).toFixed(1)}%)`);
    console.log(`Parcelas sem sócio correspondente:     ${parcelasSemSocioQtd} (${((parcelasSemSocioQtd/totalAS302Qtd)*100).toFixed(1)}%)`);
    console.log(`Parcelas que PODEM ser migradas:       ${parcelasMigraveisQtd} (${((parcelasMigraveisQtd/totalAS302Qtd)*100).toFixed(1)}%)`);
    console.log(`\nParcelas perdidas (sem venda ou sócio): ${totalAS302Qtd - parcelasMigraveisQtd}`);

    if (parcelasSemVendaQtd > 0) {
      console.log('\n⚠️  PROBLEMA CRÍTICO:');
      console.log(`   ${parcelasSemVendaQtd} parcelas não têm registro na tabela vendas.`);
      console.log('   Essas parcelas NÃO PODEM ser migradas usando o script atual.');
      console.log('   O script migrate-vendas-parcelas-v2.ts requer que a venda exista.');
    }

    if (parcelasSemSocioQtd > 0) {
      console.log('\n⚠️  ATENÇÃO:');
      console.log(`   ${parcelasSemSocioQtd} parcelas têm matrícula que não existe em socios.`);
      console.log('   Essas parcelas serão ignoradas pelo filtro (codtipo 3 ou 4).');
    }

  } catch (error) {
    console.error('Erro ao executar diagnóstico:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

main()
  .then(() => {
    console.log('\n✓ Diagnóstico concluído!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    process.exit(1);
  });

/**
 * Consulta parcelas de pensionistas no MySQL legado
 * Replica a query do programa As302.Prg (linha 113)
 * 
 * Uso: npx tsx app/scripts/consultar-parcelas-pensionistas.ts [MM-YYYY] [convenio_opcional]
 * Exemplo: npx tsx app/scripts/consultar-parcelas-pensionistas.ts 03-2026
 * Exemplo: npx tsx app/scripts/consultar-parcelas-pensionistas.ts 03-2026 123
 */

import mysql from 'mysql2/promise';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '200.98.112.240',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

async function main() {
  // Obter período da linha de comando ou usar período atual
  const args = process.argv.slice(2);
  let mesAno = args[0];
  const convenioParam = args[1];
  
  if (!mesAno) {
    // Usar período atual (março/2026 conforme data atual)
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    mesAno = `${mes}-${ano}`;
  }

  const [mes, ano] = mesAno.split('-');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  CONSULTA PARCELAS PENSIONISTAS – ${mes}/${ano}`);
  if (convenioParam) {
    console.log(`  Convênio: ${convenioParam}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // Query original do As302.Prg linha 113
    let sqlQuery = `
      SELECT 
        parcelas.*,
        socios.codtipo 
      FROM parcelas 
      LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) 
      WHERE MONTH(parcelas.vencimento) = ? 
        AND YEAR(parcelas.vencimento) = ? 
        AND TRIM(parcelas.baixa) = '' 
        AND (socios.codtipo = '3' OR socios.codtipo = '4') 
      ORDER BY 
        parcelas.associado,
        parcelas.matricula,
        parcelas.sequencia,
        parcelas.nrseq
    `;

    let params: any[] = [parseInt(mes), parseInt(ano)];

    // Se convenio foi fornecido, adicionar filtro
    if (convenioParam) {
      sqlQuery = `
        SELECT 
          parcelas.*,
          socios.codtipo 
        FROM parcelas 
        LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) 
        WHERE TRIM(parcelas.codconven) = ?
          AND MONTH(parcelas.vencimento) = ? 
          AND YEAR(parcelas.vencimento) = ? 
          AND TRIM(parcelas.baixa) = '' 
          AND (socios.codtipo = '3' OR socios.codtipo = '4') 
        ORDER BY 
          parcelas.associado,
          parcelas.matricula,
          parcelas.sequencia,
          parcelas.nrseq
      `;
      params = [convenioParam, parseInt(mes), parseInt(ano)];
    }

    console.log('Executando query...\n');
    const [rows] = await conn.execute(sqlQuery, params);
    const parcelas = rows as any[];

    console.log(`Total de parcelas encontradas: ${parcelas.length}\n`);

    if (parcelas.length === 0) {
      console.log('Nenhuma parcela encontrada com os critérios especificados.');
      return;
    }

    // Agrupar por matrícula e calcular totais
    const porMatricula = new Map<string, {
      matricula: string;
      associado: string;
      codtipo: string;
      parcelas: any[];
      total: number;
    }>();

    let totalGeral = 0;

    for (const parcela of parcelas) {
      const matricula = parcela.matricula?.trim() || '';
      const valor = parseFloat(parcela.valor) || 0;
      totalGeral += valor;

      if (!porMatricula.has(matricula)) {
        porMatricula.set(matricula, {
          matricula,
          associado: parcela.associado?.trim() || '',
          codtipo: parcela.codtipo || '',
          parcelas: [],
          total: 0
        });
      }

      const dados = porMatricula.get(matricula)!;
      dados.parcelas.push(parcela);
      dados.total += valor;
    }

    // Exibir resultados agrupados
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Mat.   │ Associado                        │ Conveniado                │ Pc│ De│ Valor      │ Sit│');
    console.log('├─────────────────────────────────────────────────────────────────────────────────────────────────┤');

    for (const [matricula, dados] of porMatricula) {
      let primeiraDaMatricula = true;
      
      for (const parcela of dados.parcelas) {
        const mat = primeiraDaMatricula ? matricula.padEnd(6) : '      ';
        const assoc = primeiraDaMatricula ? dados.associado.substring(0, 32).padEnd(32) : ' '.repeat(32);
        const conv = parcela.conveniado?.trim().substring(0, 25).padEnd(25) || ' '.repeat(25);
        const pc = String(parcela.parcelas || '').padStart(2, '0');
        const de = String(parcela.sequencia || '').padStart(2, '0');
        const valor = parseFloat(parcela.valor || 0).toFixed(2).padStart(10);
        const sit = parcela.baixa?.trim() ? 'OK' : '  ';

        console.log(`│ ${mat} │ ${assoc} │ ${conv} │ ${pc}│ ${de}│ ${valor} │ ${sit} │`);
        primeiraDaMatricula = false;
      }

      // Linha de total por matrícula
      const totalStr = dados.total.toFixed(2).padStart(10);
      console.log(`│        │                                  │                           │   │   │ ${totalStr} │ Tot│`);
      console.log('├─────────────────────────────────────────────────────────────────────────────────────────────────┤');
    }

    console.log(`│ TOTAL GERAL:                                                              │ ${totalGeral.toFixed(2).padStart(10)} │    │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────────┘');

    // Estatísticas
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ESTATÍSTICAS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total de matrículas: ${porMatricula.size}`);
    console.log(`Total de parcelas: ${parcelas.length}`);
    console.log(`Valor total: R$ ${totalGeral.toFixed(2)}`);
    console.log(`Média por matrícula: R$ ${(totalGeral / porMatricula.size).toFixed(2)}`);
    
    // Agrupar por tipo
    const porTipo = new Map<string, { count: number; total: number }>();
    for (const parcela of parcelas) {
      const tipo = parcela.codtipo || 'SEM_TIPO';
      if (!porTipo.has(tipo)) {
        porTipo.set(tipo, { count: 0, total: 0 });
      }
      const dados = porTipo.get(tipo)!;
      dados.count++;
      dados.total += parseFloat(parcela.valor || 0);
    }

    console.log('\nPor tipo de sócio:');
    for (const [tipo, dados] of porTipo) {
      const tipoDesc = tipo === '3' ? 'Pensionista' : tipo === '4' ? 'Dependente' : tipo;
      console.log(`  ${tipoDesc}: ${dados.count} parcelas - R$ ${dados.total.toFixed(2)}`);
    }

  } catch (error) {
    console.error('Erro ao executar consulta:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

main()
  .then(() => {
    console.log('\n✓ Consulta concluída com sucesso!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    process.exit(1);
  });

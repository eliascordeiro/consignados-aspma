import mysql from 'mysql2/promise';

async function testQuery() {
  const connection = await mysql.createConnection({
    host: '200.98.112.240',
    port: 3306,
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
  });

  try {
    console.log('🔍 Testando estrutura das tabelas MySQL...\n');

    // 1. Testar estrutura de parcelas
    console.log('📊 Estrutura da tabela parcelas:');
    const [parcelasColumns]: any = await connection.query(`
      SHOW COLUMNS FROM parcelas
    `);
    console.table(parcelasColumns);

    // 2. Testar estrutura de vendas
    console.log('\n📊 Estrutura da tabela vendas:');
    const [vendasColumns]: any = await connection.query(`
      SHOW COLUMNS FROM vendas
    `);
    console.table(vendasColumns);

    // 3. Testar query com dados de janeiro 2026
    console.log('\n📋 Testando query para Janeiro/2026:');
    const query = `
      SELECT 
        p.matricula,
        p.associado,
        p.codconven as convenio_codigo,
        p.conveniado as convenio_nome,
        CAST(p.nrseq AS UNSIGNED) as num_parcela,
        p.parcelas as qtd_parcelas,
        p.valor,
        p.baixa as status,
        p.vencimento
      FROM parcelas p
      WHERE YEAR(p.vencimento) = 2026
        AND MONTH(p.vencimento) = 1
      LIMIT 10
    `;

    const [rows]: any = await connection.query(query);
    console.log(`\n✅ ${rows.length} parcelas encontradas`);
    
    if (rows.length > 0) {
      console.log('\nPrimeiras 5 parcelas:');
      console.table(rows.slice(0, 5));
    }

    // 4. Verificar codconven disponíveis
    console.log('\n📋 Códigos de convênio disponíveis:');
    const [convenios]: any = await connection.query(`
      SELECT DISTINCT codconven, conveniado 
      FROM parcelas 
      WHERE YEAR(vencimento) = 2026 AND MONTH(vencimento) = 1
      LIMIT 10
    `);
    console.table(convenios);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await connection.end();
  }
}

testQuery().catch(console.error);

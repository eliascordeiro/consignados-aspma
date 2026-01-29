const mysql = require('mysql2/promise');

async function analyzeMySQL() {
  const connection = await mysql.createConnection({
    host: '200.98.112.240',
    port: 3306,
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
    charset: 'utf8mb4'
  });

  console.log('🔍 ANÁLISE DAS TABELAS VENDAS E PARCELAS NO MYSQL\n');
  console.log('='.repeat(70));

  // 1. Estrutura da tabela vendas
  console.log('\n📊 ESTRUTURA DA TABELA "vendas":');
  const [vendasColumns] = await connection.query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'aspma' AND TABLE_NAME = 'vendas'
    ORDER BY ORDINAL_POSITION
  `);
  vendasColumns.forEach(c => console.log(`  - ${c.COLUMN_NAME}: ${c.DATA_TYPE} (${c.IS_NULLABLE})`));

  // 2. Contagem de vendas
  const [vendasCount] = await connection.query('SELECT COUNT(*) as total FROM vendas');
  console.log(`\n📈 Total de vendas: ${vendasCount[0].total}`);

  // 3. Amostra de vendas
  console.log('\n📋 Amostra de vendas:');
  const [vendasSample] = await connection.query('SELECT * FROM vendas LIMIT 3');
  vendasSample.forEach(v => console.log(JSON.stringify(v, null, 2)));

  // 4. Estrutura da tabela parcelas
  console.log('\n\n📊 ESTRUTURA DA TABELA "parcelas":');
  const [parcelasColumns] = await connection.query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'aspma' AND TABLE_NAME = 'parcelas'
    ORDER BY ORDINAL_POSITION
  `);
  parcelasColumns.forEach(c => console.log(`  - ${c.COLUMN_NAME}: ${c.DATA_TYPE} (${c.IS_NULLABLE})`));

  // 5. Contagem de parcelas
  const [parcelasCount] = await connection.query('SELECT COUNT(*) as total FROM parcelas');
  console.log(`\n📈 Total de parcelas: ${parcelasCount[0].total}`);

  // 6. Verificar vendas com matrículas para atualizar
  console.log('\n\n🔍 MATRÍCULAS PARA ATUALIZAR:');
  const [vendasToUpdate] = await connection.query(`
    SELECT COUNT(*) as total 
    FROM vendas v
    INNER JOIN matriculas m ON v.matricula = m.matricula_antiga
  `);
  console.log(`  Vendas com matrículas para atualizar: ${vendasToUpdate[0].total}`);

  const [parcelasToUpdate] = await connection.query(`
    SELECT COUNT(*) as total 
    FROM parcelas p
    INNER JOIN matriculas m ON p.matricula = m.matricula_antiga
  `);
  console.log(`  Parcelas com matrículas para atualizar: ${parcelasToUpdate[0].total}`);

  // 7. Verificar se existe campo id_venda em parcelas
  console.log('\n\n🔗 RELACIONAMENTO VENDAS <-> PARCELAS:');
  try {
    const [parcelasVendaFK] = await connection.query('SELECT DISTINCT id_venda FROM parcelas LIMIT 5');
    console.log('  ✅ Campo "id_venda" existe em parcelas');
    console.log('  Amostras:', parcelasVendaFK.map(p => p.id_venda).join(', '));
  } catch(e) {
    console.log('  ❌ Campo "id_venda" NÃO existe em parcelas');
  }

  // 8. Verificar integridade
  try {
    const [orphanParcelas] = await connection.query(`
      SELECT COUNT(*) as total 
      FROM parcelas p
      LEFT JOIN vendas v ON p.id_venda = v.id
      WHERE v.id IS NULL
    `);
    console.log(`  Parcelas órfãs: ${orphanParcelas[0].total}`);
  } catch(e) {
    console.log('  Não foi possível verificar órfãos');
  }

  // 9. Status de vendas
  console.log('\n\n📊 VENDAS POR STATUS:');
  const [vendasByStatus] = await connection.query(`
    SELECT status, COUNT(*) as total FROM vendas GROUP BY status ORDER BY total DESC
  `);
  vendasByStatus.forEach(s => console.log(`  ${s.status || 'NULL'}: ${s.total}`));

  await connection.end();
  console.log('\n\n✅ Análise concluída!');
}

analyzeMySQL().catch(console.error);

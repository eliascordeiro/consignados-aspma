import mysql from 'mysql2/promise';

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
  console.log('-'.repeat(50));
  const [vendasColumns] = await connection.query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_KEY
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'aspma' AND TABLE_NAME = 'vendas'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(vendasColumns);

  // 2. Contagem de vendas
  const [vendasCount]: any = await connection.query('SELECT COUNT(*) as total FROM vendas');
  console.log(`\n📈 Total de vendas: ${vendasCount[0].total}`);

  // 3. Amostra de vendas
  console.log('\n📋 Amostra de vendas (5 primeiros):');
  const [vendasSample] = await connection.query('SELECT * FROM vendas LIMIT 5');
  console.table(vendasSample);

  // 4. Estrutura da tabela parcelas
  console.log('\n\n📊 ESTRUTURA DA TABELA "parcelas":');
  console.log('-'.repeat(50));
  const [parcelasColumns] = await connection.query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_KEY
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'aspma' AND TABLE_NAME = 'parcelas'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(parcelasColumns);

  // 5. Contagem de parcelas
  const [parcelasCount]: any = await connection.query('SELECT COUNT(*) as total FROM parcelas');
  console.log(`\n📈 Total de parcelas: ${parcelasCount[0].total}`);

  // 6. Amostra de parcelas
  console.log('\n📋 Amostra de parcelas (5 primeiros):');
  const [parcelasSample] = await connection.query('SELECT * FROM parcelas LIMIT 5');
  console.table(parcelasSample);

  // 7. Verificar se vendas tem campo matricula
  console.log('\n\n🔍 ANÁLISE DE RELACIONAMENTOS:');
  console.log('-'.repeat(50));
  
  // Verificar campos que podem conter matrícula em vendas
  const [vendasMatricula]: any = await connection.query(`
    SELECT DISTINCT matricula FROM vendas LIMIT 10
  `).catch(() => [[]]);
  
  if (vendasMatricula.length > 0) {
    console.log('\n✅ Campo "matricula" existe em vendas');
    console.log('Amostras de matrículas em vendas:', vendasMatricula.map((v: any) => v.matricula));
    
    // Quantas vendas têm matrículas que precisam ser atualizadas
    const [vendasToUpdate]: any = await connection.query(`
      SELECT COUNT(*) as total 
      FROM vendas v
      INNER JOIN matriculas m ON v.matricula = m.matricula_antiga
    `);
    console.log(`\n📊 Vendas com matrículas para atualizar: ${vendasToUpdate[0].total}`);
  }

  // Verificar campos que podem conter matrícula em parcelas
  const [parcelasMatricula]: any = await connection.query(`
    SELECT DISTINCT matricula FROM parcelas LIMIT 10
  `).catch(() => [[]]);
  
  if (parcelasMatricula.length > 0) {
    console.log('\n✅ Campo "matricula" existe em parcelas');
    console.log('Amostras de matrículas em parcelas:', parcelasMatricula.map((p: any) => p.matricula));
    
    // Quantas parcelas têm matrículas que precisam ser atualizadas
    const [parcelasToUpdate]: any = await connection.query(`
      SELECT COUNT(*) as total 
      FROM parcelas p
      INNER JOIN matriculas m ON p.matricula = m.matricula_antiga
    `);
    console.log(`\n📊 Parcelas com matrículas para atualizar: ${parcelasToUpdate[0].total}`);
  }

  // 8. Verificar relacionamento vendas <-> parcelas
  console.log('\n\n🔗 RELACIONAMENTO VENDAS <-> PARCELAS:');
  console.log('-'.repeat(50));
  
  // Verificar se parcelas tem id_venda ou similar
  const [parcelasVendaFK]: any = await connection.query(`
    SELECT DISTINCT id_venda FROM parcelas LIMIT 10
  `).catch(() => [[]]);
  
  if (parcelasVendaFK.length > 0) {
    console.log('✅ Campo "id_venda" existe em parcelas (FK para vendas)');
    
    // Verificar integridade
    const [orphanParcelas]: any = await connection.query(`
      SELECT COUNT(*) as total 
      FROM parcelas p
      LEFT JOIN vendas v ON p.id_venda = v.id
      WHERE v.id IS NULL
    `);
    console.log(`\n⚠️ Parcelas órfãs (sem venda correspondente): ${orphanParcelas[0].total}`);
  }

  // 9. Estatísticas por status
  console.log('\n\n📊 ESTATÍSTICAS DE VENDAS:');
  console.log('-'.repeat(50));
  const [vendasByStatus]: any = await connection.query(`
    SELECT status, COUNT(*) as total FROM vendas GROUP BY status ORDER BY total DESC
  `).catch(() => [[]]);
  if (vendasByStatus.length > 0) {
    console.table(vendasByStatus);
  }

  // 10. Verificar tabela matriculas para referência
  console.log('\n\n📋 TABELA DE MAPEAMENTO (matriculas):');
  console.log('-'.repeat(50));
  const [matriculasCount]: any = await connection.query('SELECT COUNT(*) as total FROM matriculas');
  console.log(`Total de mapeamentos: ${matriculasCount[0].total}`);
  
  const [matriculasSample] = await connection.query('SELECT * FROM matriculas LIMIT 5');
  console.table(matriculasSample);

  await connection.end();
  console.log('\n✅ Análise concluída!');
}

analyzeMySQL().catch(console.error);

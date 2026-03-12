/**
 * Descobre estrutura da tabela vendas do MySQL
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
  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    console.log('\n📋 Estrutura da tabela VENDAS:\n');
    
    const [columns] = await conn.execute(`
      SHOW COLUMNS FROM vendas
    `);

    (columns as any[]).forEach(col => {
      console.log(`  ${col.Field.padEnd(20)} | ${col.Type.padEnd(20)} | ${col.Null} | ${col.Key} | ${col.Default || 'NULL'}`);
    });

    console.log('\n📋 Estrutura da tabela PARCELAS:\n');
    
    const [columnsParcelas] = await conn.execute(`
      SHOW COLUMNS FROM parcelas
    `);

    (columnsParcelas as any[]).forEach(col => {
      console.log(`  ${col.Field.padEnd(20)} | ${col.Type.padEnd(20)} | ${col.Null} | ${col.Key} | ${col.Default || 'NULL'}`);
    });

    console.log('\n📋 Estrutura da tabela SOCIOS:\n');
    
    const [columnsSocios] = await conn.execute(`
      SHOW COLUMNS FROM socios
    `);

    (columnsSocios as any[]).forEach(col => {
      console.log(`  ${col.Field.padEnd(20)} | ${col.Type.padEnd(20)} | ${col.Null} | ${col.Key} | ${col.Default || 'NULL'}`);
    });

    console.log('\n📊 Exemplo de 1 registro de VENDAS:\n');
    
    const [vendas] = await conn.execute(`
      SELECT * FROM vendas LIMIT 1
    `);

    if ((vendas as any[]).length > 0) {
      const venda = (vendas as any[])[0];
      Object.keys(venda).forEach(key => {
        console.log(`  ${key.padEnd(20)}: ${venda[key]}`);
      });
    }

  } finally {await conn.end();
  }
}

main()
  .then(() => {
    console.log('\n✓ Análise concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    process.exit(1);
  });

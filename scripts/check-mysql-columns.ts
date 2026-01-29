import mysql from 'mysql2/promise';

async function checkColumns() {
  const conn = await mysql.createConnection({
    host: '200.98.112.240',
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
    port: 3306,
  });

  console.log('=== COLUNAS DA TABELA SOCIOS ===');
  const [socios] = await conn.query<any[]>('DESCRIBE socios');
  console.log(socios.map((c: any) => c.Field).join(', '));

  console.log('\n=== COLUNAS DA TABELA PARCELAS ===');
  const [parcelas] = await conn.query<any[]>('DESCRIBE parcelas');
  console.log(parcelas.map((c: any) => c.Field).join(', '));

  await conn.end();
}

checkColumns();

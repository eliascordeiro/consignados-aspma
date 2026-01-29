/**
 * Script para verificar se a atualização de matrículas foi bem-sucedida
 * Compara dados do MySQL com PostgreSQL
 */

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.remote') });

const prisma = new PrismaClient();

interface VerificationReport {
  matriculasPostgres: number;
  sociosPostgres: number;
  sociosComMatricula: number;
  vendasPostgres: number;
  parcelasPostgres: number;
  amostrasSocios: any[];
  inconsistencias: string[];
}

async function conectarMySQL() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  return connection;
}

async function verificarMatriculasPostgres(): Promise<number> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as count FROM matriculas;
  `;
  return parseInt(result[0].count);
}

async function verificarSociosPostgres() {
  const total = await prisma.socio.count();
  const comMatricula = await prisma.socio.count({
    where: {
      matricula: {
        not: null,
        not: ''
      }
    }
  });
  
  return { total, comMatricula };
}

async function buscarAmostrasSocios() {
  console.log('\n🔍 Buscando amostras de sócios atualizados...');
  
  const socios = await prisma.socio.findMany({
    where: {
      matricula: {
        not: null
      }
    },
    select: {
      id: true,
      nome: true,
      matricula: true,
      cpf: true,
      _count: {
        select: {
          vendas: true
        }
      }
    },
    take: 10,
    orderBy: {
      updatedAt: 'desc'
    }
  });
  
  return socios;
}

async function verificarConsistencia(): Promise<string[]> {
  const inconsistencias: string[] = [];
  
  console.log('\n🔍 Verificando consistência dos dados...');
  
  // Verificar se existem vendas com sócio sem matrícula
  const vendasSemMatricula = await prisma.venda.findMany({
    where: {
      socio: {
        matricula: null
      }
    },
    include: {
      socio: {
        select: {
          id: true,
          nome: true,
          matricula: true
        }
      }
    },
    take: 5
  });
  
  if (vendasSemMatricula.length > 0) {
    inconsistencias.push(
      `Encontradas ${vendasSemMatricula.length} vendas vinculadas a sócios sem matrícula`
    );
    vendasSemMatricula.forEach(venda => {
      inconsistencias.push(
        `  - Venda #${venda.numeroVenda} - Sócio: ${venda.socio.nome} (ID: ${venda.socio.id})`
      );
    });
  }
  
  // Verificar se existem matrículas duplicadas
  const duplicadas = await prisma.$queryRaw<any[]>`
    SELECT matricula, COUNT(*) as count
    FROM socios
    WHERE matricula IS NOT NULL AND matricula != ''
    GROUP BY matricula
    HAVING COUNT(*) > 1;
  `;
  
  if (duplicadas.length > 0) {
    inconsistencias.push(`Encontradas ${duplicadas.length} matrículas duplicadas:`);
    duplicadas.forEach(dup => {
      inconsistencias.push(`  - Matrícula ${dup.matricula}: ${dup.count} ocorrências`);
    });
  }
  
  return inconsistencias;
}

async function compararComMySQL(mysqlConnection: mysql.Connection) {
  console.log('\n🔄 Comparando dados com MySQL...');
  
  // Buscar total de matrículas no MySQL
  const [mysqlMatriculas] = await mysqlConnection.query<any[]>(
    'SELECT COUNT(*) as count FROM matriculas'
  );
  
  const [mysqlSocios] = await mysqlConnection.query<any[]>(
    'SELECT COUNT(*) as count FROM socios'
  );
  
  const [mysqlVendas] = await mysqlConnection.query<any[]>(
    'SELECT COUNT(*) as count FROM vendas'
  );
  
  const [mysqlParcelas] = await mysqlConnection.query<any[]>(
    'SELECT COUNT(*) as count FROM parcelas'
  );
  
  // Buscar dados do PostgreSQL
  const pgMatriculas = await verificarMatriculasPostgres();
  const pgSocios = await prisma.socio.count();
  const pgVendas = await prisma.venda.count();
  const pgParcelas = await prisma.parcela.count();
  
  console.log('\n📊 COMPARAÇÃO MYSQL vs POSTGRESQL:');
  console.log('─'.repeat(60));
  console.log('Tabela          | MySQL    | PostgreSQL | Diferença');
  console.log('─'.repeat(60));
  console.log(`Matrículas      | ${String(mysqlMatriculas[0].count).padEnd(8)} | ${String(pgMatriculas).padEnd(10)} | ${pgMatriculas - mysqlMatriculas[0].count}`);
  console.log(`Sócios          | ${String(mysqlSocios[0].count).padEnd(8)} | ${String(pgSocios).padEnd(10)} | ${pgSocios - mysqlSocios[0].count}`);
  console.log(`Vendas          | ${String(mysqlVendas[0].count).padEnd(8)} | ${String(pgVendas).padEnd(10)} | ${pgVendas - mysqlVendas[0].count}`);
  console.log(`Parcelas        | ${String(mysqlParcelas[0].count).padEnd(8)} | ${String(pgParcelas).padEnd(10)} | ${pgParcelas - mysqlParcelas[0].count}`);
  console.log('─'.repeat(60));
}

async function gerarRelatorioVerificacao(report: VerificationReport) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE VERIFICAÇÃO - ATUALIZAÇÃO DE MATRÍCULAS');
  console.log('='.repeat(80));
  
  console.log('\n1️⃣  DADOS GERAIS:');
  console.log(`   📊 Matrículas no PostgreSQL: ${report.matriculasPostgres}`);
  console.log(`   📊 Total de sócios: ${report.sociosPostgres}`);
  console.log(`   ✅ Sócios com matrícula: ${report.sociosComMatricula}`);
  console.log(`   📊 Total de vendas: ${report.vendasPostgres}`);
  console.log(`   📊 Total de parcelas: ${report.parcelasPostgres}`);
  
  const percentualComMatricula = report.sociosPostgres > 0
    ? ((report.sociosComMatricula / report.sociosPostgres) * 100).toFixed(2)
    : '0.00';
  console.log(`   📈 Percentual com matrícula: ${percentualComMatricula}%`);
  
  console.log('\n2️⃣  AMOSTRAS DE SÓCIOS ATUALIZADOS:');
  if (report.amostrasSocios.length > 0) {
    report.amostrasSocios.forEach((socio, index) => {
      console.log(`   ${index + 1}. ${socio.nome}`);
      console.log(`      Matrícula: ${socio.matricula}`);
      console.log(`      CPF: ${socio.cpf || 'N/A'}`);
      console.log(`      Vendas: ${socio._count.vendas}`);
    });
  } else {
    console.log('   ⚠️  Nenhum sócio com matrícula encontrado');
  }
  
  console.log('\n3️⃣  VERIFICAÇÃO DE CONSISTÊNCIA:');
  if (report.inconsistencias.length === 0) {
    console.log('   ✅ Nenhuma inconsistência encontrada!');
  } else {
    console.log('   ⚠️  Inconsistências encontradas:');
    report.inconsistencias.forEach(inc => {
      console.log(`   ${inc}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
}

async function verificarExemplosMapeamento(mysqlConnection: mysql.Connection) {
  console.log('\n🔍 EXEMPLOS DE MAPEAMENTO (MySQL → PostgreSQL):');
  console.log('─'.repeat(80));
  
  // Buscar algumas matrículas antigas do MySQL
  const [mysqlExemplos] = await mysqlConnection.query<any[]>(`
    SELECT s.matricula, s.associado, m.matricula_atual
    FROM socios s
    LEFT JOIN matriculas m ON CAST(s.matricula AS UNSIGNED) = m.matricula_antiga
    WHERE m.matricula_atual IS NOT NULL
    LIMIT 5
  `);
  
  console.log('MySQL (antiga) | Nome                    | PostgreSQL (atual)');
  console.log('─'.repeat(80));
  
  for (const exemplo of mysqlExemplos) {
    // Buscar no PostgreSQL
    const pgSocio = await prisma.socio.findFirst({
      where: {
        matricula: exemplo.matricula_atual.toString()
      },
      select: {
        matricula: true,
        nome: true
      }
    });
    
    const status = pgSocio ? '✅' : '❌';
    console.log(
      `${String(exemplo.matricula).padEnd(14)} | ${String(exemplo.associado).substring(0, 23).padEnd(23)} | ${exemplo.matricula_atual} ${status}`
    );
  }
  
  console.log('─'.repeat(80));
}

async function main() {
  let mysqlConnection: mysql.Connection | null = null;
  
  try {
    console.log('🚀 Iniciando verificação da atualização de matrículas...\n');
    
    // Conectar ao MySQL
    mysqlConnection = await conectarMySQL();
    
    // Coletar dados
    const report: VerificationReport = {
      matriculasPostgres: await verificarMatriculasPostgres(),
      sociosPostgres: 0,
      sociosComMatricula: 0,
      vendasPostgres: await prisma.venda.count(),
      parcelasPostgres: await prisma.parcela.count(),
      amostrasSocios: [],
      inconsistencias: []
    };
    
    const sociosInfo = await verificarSociosPostgres();
    report.sociosPostgres = sociosInfo.total;
    report.sociosComMatricula = sociosInfo.comMatricula;
    
    report.amostrasSocios = await buscarAmostrasSocios();
    report.inconsistencias = await verificarConsistencia();
    
    // Comparar com MySQL
    await compararComMySQL(mysqlConnection);
    
    // Exemplos de mapeamento
    await verificarExemplosMapeamento(mysqlConnection);
    
    // Gerar relatório
    await gerarRelatorioVerificacao(report);
    
    console.log('\n✅ Verificação concluída!\n');
    
  } catch (error) {
    console.error('\n❌ Erro durante a verificação:', error);
    throw error;
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

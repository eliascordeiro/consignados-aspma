/**
 * Script para migrar a tabela matriculas do MySQL para PostgreSQL
 * e atualizar as matrículas antigas para as atuais nas tabelas:
 * - socios
 * - vendas (via relacionamento com socios)
 * - parcelas (via relacionamento com vendas)
 */

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente do arquivo .env.remote para MySQL
dotenv.config({ path: path.resolve(__dirname, '../../.env.remote') });

const prisma = new PrismaClient();

interface MatriculaMapping {
  matricula_antiga: number;
  matricula_atual: number;
}

interface UpdateStats {
  sociosAtualizados: number;
  sociosSemMapeamento: number;
  totalSocios: number;
  erros: string[];
}

async function conectarMySQL() {
  console.log('📡 Conectando ao MySQL...');
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  console.log('✅ Conectado ao MySQL com sucesso!\n');
  return connection;
}

async function buscarMatriculas(connection: mysql.Connection): Promise<MatriculaMapping[]> {
  console.log('📥 Buscando mapeamento de matrículas do MySQL...');
  const [rows] = await connection.query<any[]>(
    'SELECT matricula_antiga, matricula_atual FROM matriculas ORDER BY matricula_antiga'
  );
  console.log(`✅ ${rows.length} mapeamentos encontrados\n`);
  return rows as MatriculaMapping[];
}

async function verificarTabelaMatriculasPostgres(): Promise<boolean> {
  try {
    // Verifica se a tabela já existe
    const result = await prisma.$queryRaw<any[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'matriculas'
      );
    `;
    return result[0]?.exists || false;
  } catch (error) {
    return false;
  }
}

async function criarTabelaMatriculas() {
  console.log('🏗️  Criando tabela matriculas no PostgreSQL...');
  
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS matriculas (
      matricula_antiga INTEGER PRIMARY KEY,
      matricula_atual INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_matricula_atual ON matriculas(matricula_atual);
  `;
  
  console.log('✅ Tabela matriculas criada com sucesso!\n');
}

async function inserirMatriculasPostgres(matriculas: MatriculaMapping[]) {
  console.log('💾 Inserindo matrículas no PostgreSQL...');
  
  // Limpar tabela se já existir dados
  await prisma.$executeRaw`DELETE FROM matriculas;`;
  
  let inseridos = 0;
  const batchSize = 500;
  
  for (let i = 0; i < matriculas.length; i += batchSize) {
    const batch = matriculas.slice(i, i + batchSize);
    
    for (const matricula of batch) {
      await prisma.$executeRaw`
        INSERT INTO matriculas (matricula_antiga, matricula_atual, created_at, updated_at)
        VALUES (${matricula.matricula_antiga}, ${matricula.matricula_atual}, NOW(), NOW())
        ON CONFLICT (matricula_antiga) DO UPDATE
        SET matricula_atual = ${matricula.matricula_atual},
            updated_at = NOW();
      `;
      inseridos++;
    }
    
    console.log(`   Progresso: ${inseridos}/${matriculas.length} matrículas inseridas`);
  }
  
  console.log(`✅ ${inseridos} matrículas inseridas com sucesso!\n`);
}

async function atualizarMatriculasSocios(): Promise<UpdateStats> {
  console.log('🔄 Atualizando matrículas na tabela socios...\n');
  
  const stats: UpdateStats = {
    sociosAtualizados: 0,
    sociosSemMapeamento: 0,
    totalSocios: 0,
    erros: []
  };
  
  // Buscar todos os sócios com matrícula
  const socios = await prisma.socio.findMany({
    where: {
      matricula: {
        not: null
      }
    },
    select: {
      id: true,
      matricula: true,
      nome: true
    }
  });
  
  stats.totalSocios = socios.length;
  console.log(`📊 Total de sócios com matrícula: ${stats.totalSocios}`);
  
  for (const socio of socios) {
    try {
      const matriculaAntiga = parseInt(socio.matricula || '0');
      
      if (isNaN(matriculaAntiga) || matriculaAntiga === 0) {
        stats.sociosSemMapeamento++;
        continue;
      }
      
      // Buscar matrícula atual
      const mapeamento = await prisma.$queryRaw<any[]>`
        SELECT matricula_atual 
        FROM matriculas 
        WHERE matricula_antiga = ${matriculaAntiga}
        LIMIT 1;
      `;
      
      if (mapeamento.length > 0) {
        const matriculaAtual = mapeamento[0].matricula_atual.toString();
        
        // Atualizar sócio
        await prisma.socio.update({
          where: { id: socio.id },
          data: { matricula: matriculaAtual }
        });
        
        stats.sociosAtualizados++;
        
        if (stats.sociosAtualizados % 100 === 0) {
          console.log(`   ✓ ${stats.sociosAtualizados} sócios atualizados...`);
        }
      } else {
        stats.sociosSemMapeamento++;
        console.log(`   ⚠️  Sócio "${socio.nome}" (ID: ${socio.id}) - Matrícula ${matriculaAntiga} não encontrada no mapeamento`);
      }
    } catch (error) {
      const errorMsg = `Erro ao atualizar sócio ${socio.id}: ${error}`;
      stats.erros.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }
  }
  
  console.log('\n📈 Estatísticas da atualização de sócios:');
  console.log(`   ✅ Sócios atualizados: ${stats.sociosAtualizados}`);
  console.log(`   ⚠️  Sócios sem mapeamento: ${stats.sociosSemMapeamento}`);
  console.log(`   📊 Total processado: ${stats.totalSocios}`);
  
  if (stats.erros.length > 0) {
    console.log(`   ❌ Erros encontrados: ${stats.erros.length}`);
  }
  
  return stats;
}

async function gerarRelatorioFinal(stats: UpdateStats, matriculas: MatriculaMapping[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO FINAL DA MIGRAÇÃO E ATUALIZAÇÃO');
  console.log('='.repeat(80));
  
  console.log('\n1️⃣  MIGRAÇÃO DA TABELA MATRICULAS:');
  console.log(`   ✅ ${matriculas.length} mapeamentos migrados do MySQL para PostgreSQL`);
  
  console.log('\n2️⃣  ATUALIZAÇÃO DAS MATRÍCULAS:');
  console.log(`   📊 Total de sócios processados: ${stats.totalSocios}`);
  console.log(`   ✅ Sócios atualizados com sucesso: ${stats.sociosAtualizados}`);
  console.log(`   ⚠️  Sócios sem mapeamento: ${stats.sociosSemMapeamento}`);
  
  const percentualAtualizado = stats.totalSocios > 0 
    ? ((stats.sociosAtualizados / stats.totalSocios) * 100).toFixed(2)
    : '0.00';
  console.log(`   📈 Percentual atualizado: ${percentualAtualizado}%`);
  
  console.log('\n3️⃣  RELACIONAMENTOS AUTOMÁTICOS:');
  console.log('   ℹ️  As tabelas VENDAS e PARCELAS estão relacionadas com SOCIOS');
  console.log('   ℹ️  Ao atualizar a matrícula do sócio, as vendas e parcelas');
  console.log('   ℹ️  automaticamente refletem a matrícula correta via relacionamento');
  
  if (stats.erros.length > 0) {
    console.log('\n4️⃣  ERROS ENCONTRADOS:');
    stats.erros.forEach((erro, index) => {
      console.log(`   ${index + 1}. ${erro}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Verificação final
  console.log('\n🔍 VERIFICAÇÃO FINAL:');
  
  const sociosComMatriculaNova = await prisma.socio.count({
    where: {
      matricula: {
        not: null
      }
    }
  });
  
  console.log(`   📊 Sócios com matrícula no sistema: ${sociosComMatriculaNova}`);
  
  const vendasComSocio = await prisma.venda.count();
  console.log(`   📊 Total de vendas vinculadas: ${vendasComSocio}`);
  
  const parcelasComVenda = await prisma.parcela.count();
  console.log(`   📊 Total de parcelas vinculadas: ${parcelasComVenda}`);
  
  console.log('\n✅ Processo concluído com sucesso!\n');
}

async function main() {
  let mysqlConnection: mysql.Connection | null = null;
  
  try {
    console.log('🚀 Iniciando migração e atualização de matrículas...\n');
    console.log('=' .repeat(80));
    
    // Passo 1: Conectar ao MySQL e buscar matrículas
    mysqlConnection = await conectarMySQL();
    const matriculas = await buscarMatriculas(mysqlConnection);
    
    // Passo 2: Verificar/Criar tabela no PostgreSQL
    const tabelaExiste = await verificarTabelaMatriculasPostgres();
    if (!tabelaExiste) {
      await criarTabelaMatriculas();
    } else {
      console.log('ℹ️  Tabela matriculas já existe no PostgreSQL\n');
    }
    
    // Passo 3: Inserir matrículas no PostgreSQL
    await inserirMatriculasPostgres(matriculas);
    
    // Passo 4: Atualizar matrículas nos sócios
    const stats = await atualizarMatriculasSocios();
    
    // Passo 5: Gerar relatório final
    await gerarRelatorioFinal(stats, matriculas);
    
  } catch (error) {
    console.error('\n❌ Erro durante a execução:', error);
    throw error;
  } finally {
    // Fechar conexões
    if (mysqlConnection) {
      await mysqlConnection.end();
      console.log('🔌 Conexão MySQL fechada');
    }
    await prisma.$disconnect();
    console.log('🔌 Conexão PostgreSQL fechada');
  }
}

// Executar script
main()
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

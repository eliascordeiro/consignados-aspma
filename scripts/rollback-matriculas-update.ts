/**
 * Script de ROLLBACK - Reverter atualização de matrículas
 * 
 * ATENÇÃO: Este script reverte as matrículas atualizadas para os valores ANTERIORES
 * Use apenas se houver problemas após a atualização
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RollbackStats {
  sociosRevertidos: number;
  erros: string[];
}

async function confirmarRollback(): Promise<boolean> {
  console.log('\n' + '⚠️ '.repeat(40));
  console.log('⚠️  ATENÇÃO - OPERAÇÃO DE ROLLBACK');
  console.log('⚠️ '.repeat(40));
  console.log('\nEste script irá REVERTER as matrículas atualizadas.');
  console.log('Todas as matrículas ATUAIS serão convertidas de volta para ANTIGAS.');
  console.log('\nExemplo: 1501 → 15, 2001 → 20, etc.');
  console.log('\n⚠️  ESTA OPERAÇÃO NÃO PODE SER DESFEITA FACILMENTE!\n');
  
  // Em produção, você poderia usar readline para confirmação
  // Por segurança, vamos exigir uma variável de ambiente
  const confirmacao = process.env.CONFIRM_ROLLBACK;
  
  if (confirmacao !== 'SIM_QUERO_REVERTER') {
    console.log('❌ Rollback cancelado por segurança.');
    console.log('\nPara executar o rollback, defina a variável de ambiente:');
    console.log('export CONFIRM_ROLLBACK=SIM_QUERO_REVERTER\n');
    return false;
  }
  
  return true;
}

async function verificarTabelaMatriculas(): Promise<boolean> {
  try {
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

async function reverterMatriculas(): Promise<RollbackStats> {
  const stats: RollbackStats = {
    sociosRevertidos: 0,
    erros: []
  };
  
  console.log('\n🔄 Iniciando reversão de matrículas...\n');
  
  // Buscar todos os sócios com matrícula
  const socios = await prisma.socio.findMany({
    where: {
      matricula: {
        not: null,
        not: ''
      }
    },
    select: {
      id: true,
      matricula: true,
      nome: true
    }
  });
  
  console.log(`📊 Total de sócios a processar: ${socios.length}\n`);
  
  for (const socio of socios) {
    try {
      const matriculaAtual = parseInt(socio.matricula || '0');
      
      if (isNaN(matriculaAtual) || matriculaAtual === 0) {
        continue;
      }
      
      // Buscar matrícula antiga correspondente
      const mapeamento = await prisma.$queryRaw<any[]>`
        SELECT matricula_antiga 
        FROM matriculas 
        WHERE matricula_atual = ${matriculaAtual}
        LIMIT 1;
      `;
      
      if (mapeamento.length > 0) {
        const matriculaAntiga = mapeamento[0].matricula_antiga.toString();
        
        // Reverter para matrícula antiga
        await prisma.socio.update({
          where: { id: socio.id },
          data: { matricula: matriculaAntiga }
        });
        
        stats.sociosRevertidos++;
        
        if (stats.sociosRevertidos % 100 === 0) {
          console.log(`   ✓ ${stats.sociosRevertidos} sócios revertidos...`);
        }
      }
    } catch (error) {
      const errorMsg = `Erro ao reverter sócio ${socio.id}: ${error}`;
      stats.erros.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }
  }
  
  return stats;
}

async function gerarRelatorioRollback(stats: RollbackStats) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE ROLLBACK - REVERSÃO DE MATRÍCULAS');
  console.log('='.repeat(80));
  
  console.log(`\n✅ Sócios revertidos: ${stats.sociosRevertidos}`);
  
  if (stats.erros.length > 0) {
    console.log(`\n❌ Erros encontrados: ${stats.erros.length}`);
    stats.erros.forEach((erro, index) => {
      console.log(`   ${index + 1}. ${erro}`);
    });
  } else {
    console.log('\n✅ Nenhum erro encontrado!');
  }
  
  // Mostrar amostras
  console.log('\n🔍 AMOSTRAS DE REVERSÃO:');
  const amostras = await prisma.socio.findMany({
    where: {
      matricula: {
        not: null
      }
    },
    select: {
      nome: true,
      matricula: true
    },
    take: 5,
    orderBy: {
      updatedAt: 'desc'
    }
  });
  
  amostras.forEach((amostra, index) => {
    console.log(`   ${index + 1}. ${amostra.nome} - Matrícula: ${amostra.matricula}`);
  });
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  try {
    console.log('🔙 Script de Rollback - Reversão de Matrículas\n');
    
    // Confirmar operação
    const confirmado = await confirmarRollback();
    if (!confirmado) {
      process.exit(0);
    }
    
    // Verificar se a tabela matriculas existe
    const tabelaExiste = await verificarTabelaMatriculas();
    if (!tabelaExiste) {
      console.log('❌ Erro: Tabela "matriculas" não encontrada!');
      console.log('   Não é possível fazer rollback sem a tabela de mapeamento.\n');
      process.exit(1);
    }
    
    console.log('✅ Tabela "matriculas" encontrada\n');
    console.log('⏳ Aguarde...\n');
    
    // Executar rollback
    const stats = await reverterMatriculas();
    
    // Gerar relatório
    await gerarRelatorioRollback(stats);
    
    console.log('\n✅ Rollback concluído!\n');
    console.log('⚠️  IMPORTANTE: Execute o script de verificação para validar:');
    console.log('   npx tsx scripts/verify-matriculas-update.ts\n');
    
  } catch (error) {
    console.error('\n❌ Erro durante o rollback:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

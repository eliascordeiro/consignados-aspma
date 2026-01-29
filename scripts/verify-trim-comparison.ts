/**
 * Script de Verificação - Comparação com e sem TRIM
 * Verifica se há diferença nos resultados ao usar trim() nas matrículas
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.remote') });

const prisma = new PrismaClient();

interface ComparacaoResultado {
  semTrim: {
    sociosComMatch: number;
    sociosSemMatch: number;
  };
  comTrim: {
    sociosComMatch: number;
    sociosSemMatch: number;
  };
  diferencas: {
    total: number;
    exemplos: Array<{
      socioId: string;
      nome: string;
      matriculaSocio: string;
      matchSemTrim: boolean;
      matchComTrim: boolean;
      matriculaEncontradaComTrim?: number;
    }>;
  };
}

async function verificarComparacao(): Promise<ComparacaoResultado> {
  console.log('🔍 Iniciando verificação com e sem TRIM...\n');

  const resultado: ComparacaoResultado = {
    semTrim: { sociosComMatch: 0, sociosSemMatch: 0 },
    comTrim: { sociosComMatch: 0, sociosSemMatch: 0 },
    diferencas: { total: 0, exemplos: [] }
  };

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
      nome: true,
      matricula: true
    }
  });

  console.log(`📊 Total de sócios a verificar: ${socios.length}\n`);
  console.log('🔄 Processando...\n');

  for (const socio of socios) {
    const matriculaSocio = socio.matricula || '';
    const matriculaSocioNum = parseInt(matriculaSocio);

    if (isNaN(matriculaSocioNum) || matriculaSocioNum === 0) {
      continue;
    }

    // 1. Verificação SEM TRIM
    const matchSemTrim = await prisma.$queryRaw<any[]>`
      SELECT matricula_atual 
      FROM matriculas 
      WHERE matricula_antiga = ${matriculaSocioNum}
      LIMIT 1;
    `;

    const temMatchSemTrim = matchSemTrim.length > 0;
    if (temMatchSemTrim) {
      resultado.semTrim.sociosComMatch++;
    } else {
      resultado.semTrim.sociosSemMatch++;
    }

    // 2. Verificação COM TRIM
    const matchComTrim = await prisma.$queryRaw<any[]>`
      SELECT matricula_atual 
      FROM matriculas 
      WHERE TRIM(CAST(matricula_antiga AS TEXT)) = TRIM(${matriculaSocio})
      LIMIT 1;
    `;

    const temMatchComTrim = matchComTrim.length > 0;
    if (temMatchComTrim) {
      resultado.comTrim.sociosComMatch++;
    } else {
      resultado.comTrim.sociosSemMatch++;
    }

    // 3. Verificar se há diferença
    if (temMatchSemTrim !== temMatchComTrim) {
      resultado.diferencas.total++;
      
      if (resultado.diferencas.exemplos.length < 20) {
        resultado.diferencas.exemplos.push({
          socioId: socio.id,
          nome: socio.nome,
          matriculaSocio: matriculaSocio,
          matchSemTrim: temMatchSemTrim,
          matchComTrim: temMatchComTrim,
          matriculaEncontradaComTrim: temMatchComTrim ? matchComTrim[0].matricula_atual : undefined
        });
      }
    }
  }

  return resultado;
}

async function verificarEspacosEmBranco() {
  console.log('\n🔍 Verificando espaços em branco nas matrículas...\n');

  // Verificar na tabela socios
  const sociosComEspacos = await prisma.$queryRaw<any[]>`
    SELECT id, nome, matricula, LENGTH(matricula) as tamanho
    FROM socios 
    WHERE matricula IS NOT NULL 
      AND matricula != ''
      AND (
        matricula != TRIM(matricula)
        OR matricula LIKE ' %'
        OR matricula LIKE '% '
      )
    LIMIT 10;
  `;

  console.log('📋 SÓCIOS COM ESPAÇOS EM BRANCO:');
  if (sociosComEspacos.length > 0) {
    console.log(`   ⚠️  Encontrados ${sociosComEspacos.length} exemplos (mostrando até 10):\n`);
    sociosComEspacos.forEach((socio, index) => {
      console.log(`   ${index + 1}. ${socio.nome}`);
      console.log(`      Matrícula: "${socio.matricula}" (tamanho: ${socio.tamanho})`);
      console.log(`      Com TRIM: "${socio.matricula.trim()}"`);
    });
  } else {
    console.log('   ✅ Nenhum sócio com espaços em branco encontrado');
  }

  // Verificar na tabela matriculas
  const matriculasComEspacos = await prisma.$queryRaw<any[]>`
    SELECT matricula_antiga, matricula_atual
    FROM matriculas 
    WHERE CAST(matricula_antiga AS TEXT) != TRIM(CAST(matricula_antiga AS TEXT))
       OR CAST(matricula_atual AS TEXT) != TRIM(CAST(matricula_atual AS TEXT))
    LIMIT 10;
  `;

  console.log('\n📋 TABELA MATRICULAS COM ESPAÇOS:');
  if (matriculasComEspacos.length > 0) {
    console.log(`   ⚠️  Encontrados ${matriculasComEspacos.length} exemplos:\n`);
    matriculasComEspacos.forEach((mat, index) => {
      console.log(`   ${index + 1}. Antiga: "${mat.matricula_antiga}" → Atual: "${mat.matricula_atual}"`);
    });
  } else {
    console.log('   ✅ Nenhuma matrícula com espaços em branco encontrada');
  }
}

async function gerarRelatorioComparacao(resultado: ComparacaoResultado) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE COMPARAÇÃO - COM E SEM TRIM');
  console.log('='.repeat(80));

  console.log('\n1️⃣  COMPARAÇÃO SEM TRIM (atual):');
  console.log(`   ✅ Sócios com match: ${resultado.semTrim.sociosComMatch}`);
  console.log(`   ⚠️  Sócios sem match: ${resultado.semTrim.sociosSemMatch}`);

  console.log('\n2️⃣  COMPARAÇÃO COM TRIM:');
  console.log(`   ✅ Sócios com match: ${resultado.comTrim.sociosComMatch}`);
  console.log(`   ⚠️  Sócios sem match: ${resultado.comTrim.sociosSemMatch}`);

  console.log('\n3️⃣  DIFERENÇAS ENCONTRADAS:');
  const diferenca = resultado.comTrim.sociosComMatch - resultado.semTrim.sociosComMatch;
  
  if (diferenca === 0) {
    console.log('   ✅ NENHUMA DIFERENÇA! O uso de TRIM não altera os resultados.');
    console.log('   ✅ Não há espaços em branco afetando as comparações.');
  } else {
    console.log(`   ⚠️  DIFERENÇA ENCONTRADA: ${Math.abs(diferenca)} sócios`);
    console.log(`   ${diferenca > 0 ? '✅' : '⚠️'}  Com TRIM: ${diferenca > 0 ? '+' : ''}${diferenca} matches adicionais`);
    
    if (resultado.diferencas.exemplos.length > 0) {
      console.log('\n   📝 EXEMPLOS DE DIFERENÇAS (até 20):');
      resultado.diferencas.exemplos.forEach((exemplo, index) => {
        console.log(`\n   ${index + 1}. ${exemplo.nome} (ID: ${exemplo.socioId})`);
        console.log(`      Matrícula no sócio: "${exemplo.matriculaSocio}"`);
        console.log(`      Match sem TRIM: ${exemplo.matchSemTrim ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`      Match com TRIM: ${exemplo.matchComTrim ? '✅ SIM' : '❌ NÃO'}`);
        if (exemplo.matriculaEncontradaComTrim) {
          console.log(`      Matrícula atual encontrada: ${exemplo.matriculaEncontradaComTrim}`);
        }
      });
    }
  }

  console.log('\n' + '='.repeat(80));

  // Recomendações
  console.log('\n💡 RECOMENDAÇÕES:\n');
  
  if (diferenca > 0) {
    console.log('   🔧 AÇÃO NECESSÁRIA:');
    console.log('   1. Execute a limpeza de espaços em branco nas matrículas');
    console.log('   2. Execute novamente a atualização de matrículas');
    console.log('   3. Isso aumentará o número de matches em ' + diferenca + ' sócios');
  } else if (diferenca < 0) {
    console.log('   ⚠️  SITUAÇÃO ANORMAL:');
    console.log('   Há menos matches com TRIM do que sem TRIM');
    console.log('   Isso pode indicar um problema nos dados');
  } else {
    console.log('   ✅ DADOS LIMPOS:');
    console.log('   Não é necessário usar TRIM nas comparações');
    console.log('   As matrículas estão sem espaços extras');
  }

  console.log('\n' + '='.repeat(80));
}

async function main() {
  try {
    console.log('🚀 Verificação de TRIM em Matrículas\n');
    console.log('=' .repeat(80));

    // 1. Verificar espaços em branco
    await verificarEspacosEmBranco();

    // 2. Fazer comparação
    const resultado = await verificarComparacao();

    // 3. Gerar relatório
    await gerarRelatorioComparacao(resultado);

    console.log('\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('\n❌ Erro durante a verificação:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Conexão PostgreSQL fechada');
  }
}

main()
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

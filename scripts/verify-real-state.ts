/**
 * Verificação do Estado Real das Matrículas Após Atualização
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verificarEstadoReal() {
  console.log('🔍 Verificando estado real das matrículas após atualização...\n');

  // 1. Verificar distribuição de matrículas
  const totalSocios = await prisma.socio.count();
  const sociosComMatricula = await prisma.socio.count({
    where: {
      matricula: { not: null, not: '' }
    }
  });

  console.log('📊 TOTAIS:');
  console.log(`   Total de sócios: ${totalSocios}`);
  console.log(`   Sócios com matrícula: ${sociosComMatricula}\n`);

  // 2. Amostras de matrículas atualizadas vs não atualizadas
  console.log('📋 AMOSTRAS DE MATRÍCULAS:\n');

  // Matrículas que parecem ser "atuais" (4 dígitos ou mais)
  const matriculasAtuais = await prisma.$queryRaw<any[]>`
    SELECT id, nome, matricula
    FROM socios
    WHERE matricula IS NOT NULL 
      AND matricula != ''
      AND CAST(matricula AS INTEGER) >= 1000
    LIMIT 10;
  `;

  console.log('✅ MATRÍCULAS ATUALIZADAS (≥ 1000 - padrão de matrícula atual):');
  matriculasAtuais.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.nome.substring(0, 30).padEnd(30)} - Matrícula: ${s.matricula}`);
  });

  // Matrículas antigas (menos de 1000)
  const matriculasAntigas = await prisma.$queryRaw<any[]>`
    SELECT id, nome, matricula
    FROM socios
    WHERE matricula IS NOT NULL 
      AND matricula != ''
      AND CAST(matricula AS INTEGER) < 1000
    LIMIT 10;
  `;

  console.log('\n⚠️  MATRÍCULAS ANTIGAS (< 1000 - podem não ter sido atualizadas):');
  if (matriculasAntigas.length > 0) {
    matriculasAntigas.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.nome.substring(0, 30).padEnd(30)} - Matrícula: ${s.matricula}`);
    });
  } else {
    console.log('   Nenhuma matrícula antiga encontrada');
  }

  // 3. Verificar se matrículas estão na tabela matriculas como "atual"
  console.log('\n🔍 VERIFICANDO SE MATRÍCULAS DOS SÓCIOS ESTÃO NA TABELA MATRICULAS:\n');

  const sociosComMatriculaAtual = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as total
    FROM socios s
    INNER JOIN matriculas m ON CAST(s.matricula AS INTEGER) = m.matricula_atual
    WHERE s.matricula IS NOT NULL AND s.matricula != '';
  `;

  const sociosComMatriculaAntiga = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as total
    FROM socios s
    INNER JOIN matriculas m ON CAST(s.matricula AS INTEGER) = m.matricula_antiga
    WHERE s.matricula IS NOT NULL AND s.matricula != '';
  `;

  console.log(`   Sócios com matrícula = matricula_atual: ${sociosComMatriculaAtual[0].total}`);
  console.log(`   Sócios com matrícula = matricula_antiga: ${sociosComMatriculaAntiga[0].total}`);

  // 4. Exemplos de comparação
  console.log('\n📝 EXEMPLOS DE MATRÍCULAS NA TABELA MATRICULAS:\n');
  
  const exemplos = await prisma.$queryRaw<any[]>`
    SELECT 
      s.nome,
      s.matricula as matricula_socio,
      m.matricula_antiga,
      m.matricula_atual,
      CASE 
        WHEN CAST(s.matricula AS INTEGER) = m.matricula_atual THEN 'ATUALIZADA'
        WHEN CAST(s.matricula AS INTEGER) = m.matricula_antiga THEN 'NÃO ATUALIZADA'
        ELSE 'OUTRO'
      END as status
    FROM socios s
    INNER JOIN matriculas m ON (
      CAST(s.matricula AS INTEGER) = m.matricula_atual OR 
      CAST(s.matricula AS INTEGER) = m.matricula_antiga
    )
    WHERE s.matricula IS NOT NULL AND s.matricula != ''
    LIMIT 15;
  `;

  exemplos.forEach((ex, i) => {
    const status = ex.status === 'ATUALIZADA' ? '✅' : '⚠️';
    console.log(`   ${i + 1}. ${ex.nome.substring(0, 25).padEnd(25)}`);
    console.log(`      Matrícula Sócio: ${ex.matricula_socio} ${status}`);
    console.log(`      Antiga: ${ex.matricula_antiga} → Atual: ${ex.matricula_atual}`);
    console.log(`      Status: ${ex.status}\n`);
  });

  // 5. Estatística final
  const total = parseInt(sociosComMatriculaAtual[0].total) + parseInt(sociosComMatriculaAntiga[0].total);
  const percentualAtualizado = total > 0 ? ((parseInt(sociosComMatriculaAtual[0].total) / total) * 100).toFixed(2) : '0.00';

  console.log('📊 ESTATÍSTICAS FINAIS:');
  console.log(`   Total de sócios com matrícula na tabela matriculas: ${total}`);
  console.log(`   Matrículas ATUALIZADAS: ${sociosComMatriculaAtual[0].total} (${percentualAtualizado}%)`);
  console.log(`   Matrículas NÃO ATUALIZADAS: ${sociosComMatriculaAntiga[0].total} (${(100 - parseFloat(percentualAtualizado)).toFixed(2)}%)`);
}

async function main() {
  try {
    console.log('=' .repeat(80));
    console.log('🔍 VERIFICAÇÃO DO ESTADO REAL DAS MATRÍCULAS');
    console.log('=' .repeat(80) + '\n');

    await verificarEstadoReal();

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Verificação concluída!\n');

  } catch (error) {
    console.error('\n❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function corrigirBaixasPensionistas() {
  console.log('\n🔧 CORREÇÃO: Parcelas de pensionistas com baixa incorreta\n');

  const dataInicio = new Date(2026, 1, 1);
  const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999);

  // 1. Contar parcelas afetadas
  const count = await prisma.parcela.count({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      baixa: 'S',
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });

  console.log(`📊 Parcelas de pensionistas em fev/2026 com baixa='S': ${count}\n`);

  if (count === 0) {
    console.log('✅ Nenhuma parcela para corrigir!');
    return;
  }

  // 2. Calcular total antes da correção
  const parcelas = await prisma.parcela.findMany({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      baixa: 'S',
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    },
    select: {
      id: true,
      valor: true,
    }
  });

  const totalValor = parcelas.reduce((sum, p) => sum + Number(p.valor), 0);

  console.log(`💰 Total dessas parcelas: R$ ${totalValor.toFixed(2)}\n`);
  console.log('⚠️  Essas parcelas estão marcadas como baixadas (S) noPostgreSQL,'  );
  console.log('   mas no MySQL estão em aberto (baixa = "" ou " ").\n');
  
  console.log('🔧 Executando correção: baixa = "S" -> "N"...\n');

  // 3. Atualizar para 'N' (não baixada)
  const result = await prisma.parcela.updateMany({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      baixa: 'S',
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    },
    data: {
      baixa: 'N'
    }
  });

  console.log(`✅ ${result.count} parcelas atualizadas de 'S' para 'N'\n`);

  // 4. Verificar resultado
  const aposCorrecao = await prisma.parcela.count({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      baixa: 'N',
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });

  console.log(`📊 Total de parcelas com baixa='N' após correção: ${aposCorrecao}`);

  await prisma.$disconnect();
}

corrigirBaixasPensionistas()
  .then(() => {
    console.log('\n✅ Correção concluída com sucesso!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

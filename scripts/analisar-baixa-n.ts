import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analisarBaixaN() {
  const dataInicio = new Date(2026, 1, 1);
  const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999);

  console.log('\n🔍 ANÁLISE: Parcelas com baixa = "N"');

  // Total de parcelas de pensionistas em fev/2026
  const total = await prisma.parcela.count({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });

  console.log(`\n📊 Total de parcelas de pensionistas em fev/2026: ${total}`);

  // Com baixa = 'N'
  const comBaixaN = await prisma.parcela.count({
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

  console.log(`📊 Parcelas com baixa = 'N': ${comBaixaN}`);

  // Com baixa = 'S'
  const comBaixaS = await prisma.parcela.count({
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

  console.log(`📊 Parcelas com baixa = 'S': ${comBaixaS}`);

  // Com baixa null
  const comBaixaNull = await prisma.parcela.count({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      baixa: null,
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });

  console.log(`📊 Parcelas com baixa = null: ${comBaixaNull}`);

  // Com baixa = ''
  const comBaixaEmpty = await prisma.parcela.count({
    where: {
      dataVencimento: { gte: dataInicio, lte: dataFim },
      baixa: '',
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });

  console.log(`📊 Parcelas com baixa = '': ${comBaixaEmpty}`);

  // Agrupar por valor de baixa
  console.log('\n📊 DISTRIBUIÇÃO de valores do campo baixa:\n');
  
  const result: any = await prisma.$queryRaw`
    SELECT p.baixa, COUNT(*) as count, SUM(p.valor::numeric) as total
    FROM "Parcela" p
    INNER JOIN "Venda" v ON p."vendaId" = v.id
    INNER JOIN "Socio" s ON v."socioId" = s.id
    WHERE p."dataVencimento" >= ${dataInicio}
      AND p."dataVencimento" <= ${dataFim}
      AND s."codTipo" IN (3, 4)
    GROUP BY p.baixa
    ORDER BY count DESC
  `;

  for (const row of result) {
    const baixaDisplay = row.baixa === null ? 'NULL' :
                         row.baixa === '' ? '""' :
                         `"${row.baixa}"`;
    console.log(`   ${baixaDisplay.padEnd(15)}: ${String(row.count).padStart(5)} parcelas | Total: R$ ${Number(row.total).toFixed(2)}`);
  }

  await prisma.$disconnect();
}

analisarBaixaN()
  .then(() => {
    console.log('\n✅ Análise concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

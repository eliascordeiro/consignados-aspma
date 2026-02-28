import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigarPensionistas() {
  console.log('\n🔍 INVESTIGAÇÃO: Pensionistas no PostgreSQL\n');

  // 1. Total de sócios tipo 3 e 4
  const sociosPensionistas = await prisma.socio.count({
    where: {
      codTipo: { in: [3, 4] }
    }
  });
  
  console.log(`📊 Total de SÓCIOS com codTipo 3 ou 4: ${sociosPensionistas}`);

  // 2. Vendas de sócios tipo 3 e 4
  const vendasPensionistas = await prisma.venda.count({
    where: {
      socio: {
        codTipo: { in: [3, 4] }
      }
    }
  });
  
  console.log(`📊 Total de VENDAS de sócios tipo 3/4: ${vendasPensionistas}`);

  // 3. Parcelas de vendas de sócios tipo 3 e 4 (sem filtro de data)
  const parcelasPensionistas = await prisma.parcela.count({
    where: {
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });
  
  console.log(`📊 Total de PARCELAS de vendas de sócios 3/4: ${parcelasPensionistas}`);

  // 4. Parcelas de fevereiro/2026
  const dataInicio = new Date(2026, 1, 1, 0, 0, 0);
  const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999);
  
  const parcelasFev2026 = await prisma.parcela.count({
    where: {
      dataVencimento: {
        gte: dataInicio,
        lte: dataFim,
      }
    }
  });
  
  console.log(`📊 Total de PARCELAS em fev/2026 (todos os tipos): ${parcelasFev2026}`);

  // 5. Parcelas de pensionistas em fev/2026 (sem filtro de baixa)
  const parcelasPensFev = await prisma.parcela.count({
    where: {
      dataVencimento: {
        gte: dataInicio,
        lte: dataFim,
      },
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });
  
  console.log(`📊 Total de PARCELAS de pensionistas em fev/2026: ${parcelasPensFev}`);

  // 6. Parcelas de pensionistas em fev/2026 SEM baixa
  const parcelasSemBaixa = await prisma.parcela.count({
    where: {
      dataVencimento: {
        gte: dataInicio,
        lte: dataFim,
      },
      OR: [
        { baixa: null },
        { baixa: '' },
        { baixa: ' ' },
      ],
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    }
  });
  
  console.log(`📊 Total de PARCELAS de pensionistas fev/2026 SEM baixa: ${parcelasSemBaixa}`);

  // 7. Amostra de sócios tipo 3 e 4
  console.log('\n📋 AMOSTRA de 10 sócios tipo 3/4:');
  const amostraSocios = await prisma.socio.findMany({
    where: {
      codTipo: { in: [3, 4] }
    },
    select: {
      id: true,
      matricula: true,
      nome: true,
      codTipo: true,
      _count: {
        select: {
          vendas: true
        }
      }
    },
    take: 10
  });

  for (const socio of amostraSocios) {
    console.log(`   • ${socio.matricula?.padEnd(10)} | ${socio.nome.substring(0, 30).padEnd(30)} | Tipo: ${socio.codTipo} | Vendas: ${socio._count.vendas}`);
  }

  // 8. Verificar se há vendas com socioId null
  const vendasSemSocio = await prisma.venda.count({
    where: {
      socioId: null
    }
  });
  
  console.log(`\n⚠️  Vendas SEM socioId: ${vendasSemSocio}`);

  // 9. Verificar distribuição de codTipo
  console.log('\n📊 DISTRIBUIÇÃO de codTipo nos sócios:');
  
  const distribuicao = await prisma.socio.groupBy({
    by: ['codTipo'],
    _count: {
      codTipo: true
    },
    orderBy: {
      codTipo: 'asc'
    }
  });

  for (const item of distribuicao) {
    console.log(`   Tipo ${item.codTipo}: ${item._count.codTipo} sócios`);
  }

  // 10. Verificar se codTipo está como string ao invés de número
  console.log('\n🔍 Verificando se codTipo pode estar como STRING...');
  
  const result = await prisma.$queryRaw`
    SELECT "codTipo", COUNT(*) as count
    FROM "Socio"
    WHERE "codTipo" IS NOT NULL
    GROUP BY "codTipo"
    ORDER BY "codTipo"
  `;
  
  console.log('Resultado da query RAW:');
  console.log(result);

  await prisma.$disconnect();
}

investigarPensionistas()
  .then(() => {
    console.log('\n✅ Investigação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

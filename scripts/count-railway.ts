import { PrismaClient } from '@prisma/client';

// Força usar a URL do Railway
process.env.DATABASE_URL = 'postgres://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';

const prisma = new PrismaClient();

async function countRecords() {
  try {
    const [vendas, parcelas] = await Promise.all([
      prisma.venda.count(),
      prisma.parcela.count(),
    ]);

    console.log('📊 Registros no Railway:');
    console.log(`   Vendas: ${vendas.toLocaleString('pt-BR')}`);
    console.log(`   Parcelas: ${parcelas.toLocaleString('pt-BR')}`);
    
    if (vendas > 0) {
      // Pegar amostra de vendas
      const sample = await prisma.venda.findMany({
        take: 5,
        include: {
          _count: {
            select: { parcelas: true },
          },
        },
        orderBy: {
          dataEmissao: 'desc',
        },
      });

      console.log('\n📋 Amostra de vendas:');
      sample.forEach((v) => {
        console.log(`   #${v.numeroVenda} - ${v._count.parcelas} parcelas - ${v.ativo ? '✅ Ativo' : '❌ Inativo'}`);
      });
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countRecords();

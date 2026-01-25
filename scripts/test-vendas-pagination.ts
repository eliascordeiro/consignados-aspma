// Script de teste para verificar paginação de vendas
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVendasPagination() {
  try {
    console.log('🔍 Testando paginação de vendas...\n');

    // 1. Contar total de vendas
    const total = await prisma.venda.count();
    console.log(`📊 Total de vendas no banco: ${total}\n`);

    // 2. Testar primeira página (offset-based)
    console.log('📄 Testando paginação offset-based (página 1, limit 10)...');
    const page1 = await prisma.venda.findMany({
      take: 10,
      skip: 0,
      include: {
        socio: {
          select: {
            id: true,
            nome: true,
            matricula: true,
          },
        },
        convenio: {
          select: {
            id: true,
            razao_soc: true,
          },
        },
        parcelas: {
          select: {
            id: true,
            numeroParcela: true,
            baixa: true,
          },
        },
      },
      orderBy: [
        { dataEmissao: 'desc' },
        { numeroVenda: 'desc' },
      ],
    });

    console.log(`✅ Retornou ${page1.length} vendas`);
    if (page1.length > 0) {
      console.log(`   Primeira venda: #${page1[0].numeroVenda} - ${page1[0].socio.nome}`);
      console.log(`   Parcelas da primeira venda: ${page1[0].parcelas.length}`);
      console.log(`   Convênio: ${page1[0].convenio?.razao_soc || 'Sem convênio'}\n`);
    }

    // 3. Testar cursor-based pagination
    console.log('🔄 Testando paginação cursor-based (primeira página)...');
    const cursor1 = await prisma.venda.findMany({
      take: 11, // 10 + 1 para verificar hasMore
      include: {
        socio: {
          select: {
            id: true,
            nome: true,
            matricula: true,
          },
        },
        convenio: {
          select: {
            id: true,
            razao_soc: true,
          },
        },
        parcelas: {
          select: {
            id: true,
            numeroParcela: true,
            baixa: true,
          },
        },
      },
      orderBy: [
        { dataEmissao: 'desc' },
        { numeroVenda: 'desc' },
      ],
    });

    const hasMore = cursor1.length > 10;
    const data = hasMore ? cursor1.slice(0, -1) : cursor1;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    console.log(`✅ Retornou ${data.length} vendas`);
    console.log(`   HasMore: ${hasMore}`);
    console.log(`   NextCursor: ${nextCursor?.substring(0, 10)}...`);
    
    if (data.length > 0) {
      console.log(`   Última venda desta página: #${data[data.length - 1].numeroVenda}\n`);
    }

    // 4. Testar segunda página com cursor
    if (nextCursor) {
      console.log('🔄 Testando segunda página com cursor...');
      const cursor2 = await prisma.venda.findMany({
        take: 11,
        cursor: { id: nextCursor },
        skip: 1, // Pula o cursor
        include: {
          socio: {
            select: {
              id: true,
              nome: true,
              matricula: true,
            },
          },
          convenio: {
            select: {
              id: true,
              razao_soc: true,
            },
          },
          parcelas: {
            select: {
              id: true,
              numeroParcela: true,
              baixa: true,
            },
          },
        },
        orderBy: [
          { dataEmissao: 'desc' },
          { numeroVenda: 'desc' },
        ],
      });

      const hasMore2 = cursor2.length > 10;
      const data2 = hasMore2 ? cursor2.slice(0, -1) : cursor2;

      console.log(`✅ Segunda página retornou ${data2.length} vendas`);
      console.log(`   HasMore: ${hasMore2}`);
      
      if (data2.length > 0) {
        console.log(`   Primeira venda da página 2: #${data2[0].numeroVenda}`);
        console.log(`   Parcelas: ${data2[0].parcelas.length}\n`);
      }
    }

    // 5. Verificar vendas com parcelas
    console.log('🔍 Verificando vendas com parcelas...');
    const vendasComParcelas = await prisma.venda.findMany({
      take: 5,
      include: {
        _count: {
          select: { parcelas: true },
        },
        parcelas: true,
      },
      orderBy: {
        dataEmissao: 'desc',
      },
    });

    vendasComParcelas.forEach((venda) => {
      console.log(`   Venda #${venda.numeroVenda}: ${venda._count.parcelas} parcelas`);
    });

    console.log('\n✨ Teste concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVendasPagination();

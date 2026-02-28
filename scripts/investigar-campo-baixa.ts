import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigarCampoBaixa() {
  console.log('\n🔍 INVESTIGAÇÃO: Campo BAIXA nas parcelas de pensionistas\n');

  const dataInicio = new Date(2026, 1, 1, 0, 0, 0);
  const dataFim = new Date(2026, 1, 28, 23, 59, 59, 999);

  // Buscar TODAS as parcelas de pensionistas de fev/2026
  const parcelas = await prisma.parcela.findMany({
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
    },
    select: {
      id: true,
      numeroParcela: true,
      valor: true,
      baixa: true,
      dataVencimento: true,
      venda: {
        select: {
          numeroVenda: true,
          socio: {
            select: {
              matricula: true,
              nome: true,
            }
          }
        }
      }
    },
    take: 50 // Primeiras 50 para análise
  });

  console.log(`📊 Total de parcelas encontradas: ${parcelas.length}\n`);

  // Agrupar por valor do campo baixa
  const grupos = new Map<string, number>();
  let totalComBaixa = 0;
  let totalSemBaixa = 0;

  for (const p of parcelas) {
    const valorBaixa = p.baixa === null ? 'NULL' : 
                       p.baixa === '' ? 'EMPTY_STRING' :
                       p.baixa === ' ' ? 'SINGLE_SPACE' :
                       `"${p.baixa}"`;
    
    grupos.set(valorBaixa, (grupos.get(valorBaixa) || 0) + 1);
    
    if (p.baixa === null || p.baixa === '' || p.baixa === ' ') {
      totalSemBaixa++;
    } else {
      totalComBaixa++;
    }
  }

  console.log('📊 DISTRIBUIÇÃO do campo "baixa":\n');
  for (const [valor, count] of Array.from(grupos.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${valor.padEnd(20)}: ${count} parcelas`);
  }

  console.log(`\n📊 RESUMO:`);
  console.log(`   Parcelas SEM baixa (null, '' ou ' '): ${totalSemBaixa}`);
  console.log(`   Parcelas COM baixa: ${totalComBaixa}\n`);

  // Mostrar amostra de 10 parcelas
  console.log('📋 AMOSTRA de 10 parcelas:\n');
  for (let i = 0; i < Math.min(10, parcelas.length); i++) {
    const p = parcelas[i];
    const baixaDisplay = p.baixa === null ? 'NULL' :
                          p.baixa === '' ? '""' :
                          p.baixa === ' ' ? '" "' :
                          `"${p.baixa}"`;
    
    console.log(`   Parcela ${i + 1}:`);
    console.log(`      Matrícula: ${p.venda.socio.matricula} | ${p.venda.socio.nome.substring(0, 30)}`);
    console.log(`      Venda: ${p.venda.numeroVenda} | Parcela: ${p.numeroParcela}`);
    console.log(`      Valor: R$ ${Number(p.valor).toFixed(2)}`);
    console.log(`      Baixa: ${baixaDisplay} (length: ${p.baixa?.length || 0})`);
    console.log(`      Data: ${p.dataVencimento.toLocaleDateString('pt-BR')}\n`);
  }

  // Verificar se há parcelas que DEVERIAM passar no filtro AS302.PRG
  console.log('🔍 Verificando com lógica AS302.PRG (TRIM(baixa) = ""):\n');
  
  const comBaixaVazia = parcelas.filter(p => {
    if (p.baixa === null) return false; // MySQL TRIM(NULL) != ''
    return p.baixa.trim() === '';
  });

  console.log(`   Parcelas onde TRIM(baixa) = "": ${comBaixaVazia.length}`);

  if (comBaixaVazia.length > 0) {
    console.log('\n   Detalhes dessas parcelas:');
    for (const p of comBaixaVazia.slice(0, 5)) {
      const baixaEscaped = JSON.stringify(p.baixa);
      console.log(`      • Mat: ${p.venda.socio.matricula} | Baixa original: ${baixaEscaped} | TRIM: "${p.baixa.trim()}"`);
    }
  }

  // Total de valores dessas parcelas
  const totalValor = parcelas
    .filter(p => p.baixa !== null && p.baixa.trim() === '')
    .reduce((sum, p) => sum + Number(p.valor), 0);

  console.log(`\n💰 Total de parcelas com TRIM(baixa) = "": R$ ${totalValor.toFixed(2)}`);

  await prisma.$disconnect();
}

investigarCampoBaixa()
  .then(() => {
    console.log('\n✅ Investigação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

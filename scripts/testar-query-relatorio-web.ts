/**
 * TESTE: Replicar Query do Relatório Web
 * 
 * Este script replica EXATAMENTE a query que o relatório web usa
 * em /api/relatorios/debitos-socios/route.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TESTE: Query Correta do Relatório Web');
  console.log('  Replicando /api/relatorios/debitos-socios');
  console.log('═══════════════════════════════════════════════════════════\n');

  const ano = 2026;
  const mes = 3;

  // Data início e fim do mês
  const dataInicio = new Date(ano, mes - 1, 1, 0, 0, 0);
  const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);

  console.log(`Período: ${mes.toString().padStart(2, '0')}/${ano}`);
  console.log(`Data início: ${dataInicio.toISOString()}`);
  console.log(`Data fim: ${dataFim.toISOString()}\n`);

  // QUERY CORRETA conforme /api/relatorios/debitos-socios/route.ts
  const where: any = {
    dataVencimento: {
      gte: dataInicio,
      lte: dataFim,
    },
    // Filtro de parcelas em aberto
    OR: [
      { baixa: null },
      { baixa: '' },
      { baixa: ' ' },
      { baixa: 'N' },
    ],
    // Filtro de pensionistas: codTipo 3 ou 4
    venda: {
      socio: {
        codTipo: { in: [3, 4] },
      },
    },
  };

  console.log('Filtros aplicados:');
  console.log(JSON.stringify(where, null, 2));
  console.log('\n');

  const parcelas = await prisma.parcela.findMany({
    where,
    include: {
      venda: {
        select: {
          numeroVenda: true,
          quantidadeParcelas: true,
          socio: {
            select: {
              matricula: true,
              nome: true,
              codTipo: true,
            },
          },
          convenio: {
            select: {
              codigo: true,
              razao_soc: true,
            },
          },
        },
      },
    },
    orderBy: [
      { venda: { socio: { nome: 'asc' } } },
      { venda: { socio: { matricula: 'asc' } } },
      { venda: { numeroVenda: 'asc' } },
      { numeroParcela: 'asc' },
    ],
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RESULTADOS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const totalParcelas = parcelas.length;
  const totalValor = parcelas.reduce((sum, p) => sum + parseFloat(String(p.valor)), 0);

  // Contar matrículas únicas
  const matriculasUnicas = new Set(parcelas.map(p => p.venda.socio.matricula));

  // Agrupar por tipo
  const porTipo = parcelas.reduce((acc, p) => {
    const tipo = p.venda.socio.codTipo === 3 ? 'Pensionista' : 'Dependente';
    if (!acc[tipo]) {
      acc[tipo] = { qtd: 0, valor: 0 };
    }
    acc[tipo].qtd++;
    acc[tipo].valor += parseFloat(String(p.valor));
    return acc;
  }, {} as Record<string, { qtd: number; valor: number }>);

  console.log(`Total de parcelas: ${totalParcelas}`);
  console.log(`Total de matrículas: ${matriculasUnicas.size}`);
  console.log(`Valor total: R$ ${totalValor.toFixed(2)}\n`);

  console.log('Por tipo de sócio:');
  for (const [tipo, dados] of Object.entries(porTipo)) {
    console.log(`  ${tipo}: ${dados.qtd} parcelas - R$ ${dados.valor.toFixed(2)}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  COMPARAÇÃO COM RELATÓRIO WEB');
  console.log('═══════════════════════════════════════════════════════════\n');

  const valorRelatorioWeb = 1173623.60;
  const diferenca = valorRelatorioWeb - totalValor;
  const percentualDiferenca = (diferenca / valorRelatorioWeb) * 100;

  console.log(`Relatório Web:    R$ ${valorRelatorioWeb.toFixed(2)}`);
  console.log(`Script (Prisma):  R$ ${totalValor.toFixed(2)}`);
  console.log(`Diferença:        R$ ${diferenca.toFixed(2)} (${percentualDiferenca.toFixed(3)}%)\n`);

  if (Math.abs(diferenca) < 1) {
    console.log('✅ PERFEITO! Os valores estão idênticos (diferença < R$ 1,00)');
  } else if (Math.abs(diferenca) < 100) {
    console.log('✅ MUITO BOM! Diferença mínima, provavelmente arredondamentos');
  } else if (Math.abs(diferenca) < 1000) {
    console.log('⚠️  Diferença pequena, verificar alguns registros');
  } else {
    console.log('❌ Diferença significativa, investigar filtros');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  PRIMEIRAS 10 PARCELAS (Amostra)');
  console.log('═══════════════════════════════════════════════════════════\n');

  parcelas.slice(0, 10).forEach((p, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. Mat: ${p.venda.socio.matricula?.padEnd(10)} | ` +
      `${p.venda.socio.nome?.substring(0, 30).padEnd(30)} | ` +
      `Parc ${p.numeroParcela}/${p.venda.quantidadeParcelas} | ` +
      `R$ ${parseFloat(String(p.valor)).toFixed(2).padStart(10)} | ` +
      `Tipo ${p.venda.socio.codTipo}`);
  });

  if (parcelas.length > 10) {
    console.log(`\n... e mais ${parcelas.length - 10} parcelas`);
  }
}

main()
  .then(() => {
    console.log('\n✓ Teste concluído!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

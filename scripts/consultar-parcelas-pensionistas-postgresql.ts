/**
 * Consulta parcelas de pensionistas no PostgreSQL Railway
 * Replica a query do programa As302.Prg (linha 113) mas nas tabelas migradas
 * 
 * Uso: npx tsx app/scripts/consultar-parcelas-pensionistas-postgresql.ts [MM-YYYY] [convenio_opcional]
 * Exemplo: npx tsx app/scripts/consultar-parcelas-pensionistas-postgresql.ts 03-2026
 * Exemplo: npx tsx app/scripts/consultar-parcelas-pensionistas-postgresql.ts 03-2026 123
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Obter período da linha de comando ou usar período atual
  const args = process.argv.slice(2);
  let mesAno = args[0];
  const convenioParam = args[1];
  
  if (!mesAno) {
    // Usar período atual (março/2026 conforme data atual)
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    mesAno = `${mes}-${ano}`;
  }

  const [mesStr, anoStr] = mesAno.split('-');
  const mes = parseInt(mesStr);
  const ano = parseInt(anoStr);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  CONSULTA PARCELAS PENSIONISTAS – ${mesStr}/${anoStr}`);
  console.log('  BASE: PostgreSQL Railway (Migrado)');
  if (convenioParam) {
    console.log(`  Convênio: ${convenioParam}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Data início e fim do mês (mesmo padrão usado na API)
    const dataInicio = new Date(ano, mes - 1, 1, 0, 0, 0);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);

    // Construir filtros
    const where: any = {
      dataVencimento: {
        gte: dataInicio,
        lte: dataFim,
      },
      // Filtro de parcelas em aberto (sem baixa) - AS302.PRG: TRIM(parcelas.baixa) = ''
      OR: [
        { baixa: null },
        { baixa: '' },
        { baixa: ' ' },
        { baixa: 'N' }, // Migração MySQL->PG: 'N' = não baixada
      ],
      // Filtro por tipo de sócio AS302.PRG: codtipo = '3' OR codtipo = '4' (pensionistas)
      venda: {
        socio: {
          codTipo: { in: [3, 4] }
        }
      }
    };

    // Se convenio foi fornecido, adicionar filtro
    if (convenioParam) {
      where.venda.convenio = {
        codigo: convenioParam
      };
    }

    console.log('Executando query no PostgreSQL...\n');
    
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

    console.log(`Total de parcelas encontradas: ${parcelas.length}\n`);

    if (parcelas.length === 0) {
      console.log('Nenhuma parcela encontrada com os critérios especificados.');
      return;
    }

    // Agrupar por matrícula e calcular totais
    const porMatricula = new Map<string, {
      matricula: string;
      associado: string;
      codTipo: string;
      parcelas: any[];
      total: number;
    }>();

    let totalGeral = 0;

    for (const parcela of parcelas) {
      const matricula = parcela.venda.socio.matricula?.trim() || '';
      const valor = parseFloat(String(parcela.valor)) || 0;
      totalGeral += valor;

      if (!porMatricula.has(matricula)) {
        porMatricula.set(matricula, {
          matricula,
          associado: parcela.venda.socio.nome?.trim() || '',
          codTipo: String(parcela.venda.socio.codTipo || ''),
          parcelas: [],
          total: 0
        });
      }

      const dados = porMatricula.get(matricula)!;
      dados.parcelas.push(parcela);
      dados.total += valor;
    }

    // Exibir resultados agrupados
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Mat.   │ Associado                        │ Conveniado                │ Pc│ De│ Valor      │ Sit│');
    console.log('├─────────────────────────────────────────────────────────────────────────────────────────────────┤');

    for (const [matricula, dados] of porMatricula) {
      let primeiraDaMatricula = true;
      
      for (const parcela of dados.parcelas) {
        const mat = primeiraDaMatricula ? matricula.padEnd(6) : '      ';
        const assoc = primeiraDaMatricula ? dados.associado.substring(0, 32).padEnd(32) : ' '.repeat(32);
        const conv = parcela.venda.convenio?.razao_soc?.trim().substring(0, 25).padEnd(25) || ' '.repeat(25);
        const pc = String(parcela.numeroParcela || '').padStart(2, '0');
        const de = String(parcela.venda.quantidadeParcelas || '').padStart(2, '0');
        const valor = parseFloat(String(parcela.valor) || '0').toFixed(2).padStart(10);
        const sit = parcela.baixa?.trim() === 'S' ? 'OK' : '  ';

        console.log(`│ ${mat} │ ${assoc} │ ${conv} │ ${pc}│ ${de}│ ${valor} │ ${sit} │`);
        primeiraDaMatricula = false;
      }

      // Linha de total por matrícula
      const totalStr = dados.total.toFixed(2).padStart(10);
      console.log(`│        │                                  │                           │   │   │ ${totalStr} │ Tot│`);
      console.log('├─────────────────────────────────────────────────────────────────────────────────────────────────┤');
    }

    console.log(`│ TOTAL GERAL:                                                              │ ${totalGeral.toFixed(2).padStart(10)} │    │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────────┘');

    // Estatísticas
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ESTATÍSTICAS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total de matrículas: ${porMatricula.size}`);
    console.log(`Total de parcelas: ${parcelas.length}`);
    console.log(`Valor total: R$ ${totalGeral.toFixed(2)}`);
    console.log(`Média por matrícula: R$ ${(totalGeral / porMatricula.size).toFixed(2)}`);
    
    // Agrupar por tipo
    const porTipo = new Map<string, { count: number; total: number }>();
    for (const parcela of parcelas) {
      const tipo = String(parcela.venda.socio.codTipo || 'SEM_TIPO');
      if (!porTipo.has(tipo)) {
        porTipo.set(tipo, { count: 0, total: 0 });
      }
      const dados = porTipo.get(tipo)!;
      dados.count++;
      dados.total += parseFloat(String(parcela.valor) || '0');
    }

    console.log('\nPor tipo de sócio:');
    for (const [tipo, dados] of porTipo) {
      const tipoDesc = tipo === '3' ? 'Pensionista' : tipo === '4' ? 'Dependente' : tipo;
      console.log(`  ${tipoDesc}: ${dados.count} parcelas - R$ ${dados.total.toFixed(2)}`);
    }

    // Comparação com MySQL (se disponível no log anterior)
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  COMPARAÇÃO COM MYSQL LEGADO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Execute o script consultar-parcelas-pensionistas.ts para comparar');
    console.log('com os dados do MySQL legado.');

  } catch (error) {
    console.error('Erro ao executar consulta:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✓ Consulta concluída com sucesso!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    process.exit(1);
  });

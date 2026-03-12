/**
 * MIGRAÇÃO PASSO 3: Corrigir Vendas e Parcelas
 * 
 * Este script corrige o problema de agrupamento incorreto das vendas:
 * - ANTES: Agrupava por matricula-convenio (múltiplas vendas mescladas)
 * - DEPOIS: Agrupa por matricula-convenio-sequencia (cada venda separada)
 * 
 * Execução:
 * 1. migrate-all-to-railway.ts (migra sócios, convênios, empresas)
 * 2. migrate-vendas-parcelas-v2.ts (primeira tentativa - com bug)
 * 3. migrate-corrigir-vendas-parcelas.ts (este script - corrige o bug)
 */

import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '200.98.112.240',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

interface Estatisticas {
  vendasAnalisadas: number;
  vendasCriadas: number;
  vendasAtualizadas: number;
  vendasIgnoradas: number;
  parcelasCriadas: number;
  parcelasAtualizadas: number;
  parcelasIgnoradas: number;
  erros: string[];
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  MIGRAÇÃO PASSO 3: Corrigir Vendas e Parcelas');
  console.log('  Correção do agrupamento incorreto');
  console.log('═══════════════════════════════════════════════════════════\n');

  const stats: Estatisticas = {
    vendasAnalisadas: 0,
    vendasCriadas: 0,
    vendasAtualizadas: 0,
    vendasIgnoradas: 0,
    parcelasCriadas: 0,
    parcelasAtualizadas: 0,
    parcelasIgnoradas: 0,
    erros: [],
  };

  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    console.log('📦 1. Buscando empresa ASPMA no PostgreSQL...\n');

    let empresaAspma = await prisma.empresa.findFirst({
      where: {
        OR: [
          { nome: { contains: 'ASPMA', mode: 'insensitive' } },
          { nome: { contains: 'Associação dos Servidores Públicos', mode: 'insensitive' } },
        ],
      },
    });

    if (!empresaAspma) {
      console.log('   ❌ Empresa ASPMA não encontrada!');
      console.log('   → Execute primeiro: migrate-all-to-railway.ts\n');
      return;
    }

    console.log(`   ✅ Empresa ASPMA encontrada: ${empresaAspma.nome} (ID: ${empresaAspma.id})\n`);

    // ══════════════════════════════════════════════════════════════════
    // 2. BUSCAR TODAS AS PARCELAS DO MYSQL
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 2. Buscando parcelas do MySQL...\n');

    const [parcelasMySQL] = await mysqlConn.execute(`
      SELECT 
        TRIM(p.matricula) as matricula,
        TRIM(p.sequencia) as sequencia,
        TRIM(p.nrseq) as nrseq,
        TRIM(p.associado) as associado,
        TRIM(p.codconven) as codconven,
        TRIM(p.conveniado) as conveniado,
        p.parcelas as qtd_parcelas,
        p.valor,
        TRIM(p.baixa) as baixa,
        p.vencimento
      FROM parcelas p
      ORDER BY p.matricula, p.sequencia, p.nrseq
    `);

    const parcelas = parcelasMySQL as any[];
    console.log(`   ✅ ${parcelas.length.toLocaleString()} parcelas encontradas\n`);

    // ══════════════════════════════════════════════════════════════════
    // 3. AGRUPAR POR VENDA (matricula-convenio-sequencia)
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 3. Agrupando parcelas por venda (correção do bug)...\n');

    const vendasMap = new Map<string, any>();

    parcelas.forEach((parcela) => {
      // ✅ CORREÇÃO: Usar matricula-convenio-sequencia (não apenas matricula-convenio)
      const key = `${parcela.matricula}-${parcela.codconven}-${parcela.sequencia}`;

      if (!vendasMap.has(key)) {
        // ✅ CORREÇÃO: Usar sequencia real do MySQL como numeroVenda
        const numeroVenda = parseInt(parcela.sequencia) || 0;

        vendasMap.set(key, {
          matricula: parcela.matricula,
          sequencia: parcela.sequencia,
          numeroVenda: numeroVenda,
          associado: parcela.associado,
          codconven: parcela.codconven,
          conveniado: parcela.conveniado,
          qtd_parcelas: parcela.qtd_parcelas,
          parcelas: [],
        });
      }

      vendasMap.get(key)!.parcelas.push(parcela);
    });

    console.log(`   ✅ ${vendasMap.size.toLocaleString()} vendas únicas identificadas\n`);
    console.log(`   📊 Média de ${(parcelas.length / vendasMap.size).toFixed(1)} parcelas por venda\n`);

    // ══════════════════════════════════════════════════════════════════
    // 4. PROCESSAR CADA VENDA
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 4. Processando vendas e parcelas...\n');

    let processadas = 0;
    const totalVendas = vendasMap.size;

    for (const [key, vendaData] of vendasMap) {
      processadas++;

      if (processadas % 100 === 0) {
        const percentual = ((processadas / totalVendas) * 100).toFixed(1);
        console.log(`   📊 Progresso: ${processadas.toLocaleString()}/${totalVendas.toLocaleString()} (${percentual}%)`);
      }

      try {
        stats.vendasAnalisadas++;

        // Buscar ou criar sócio
        let socio = await prisma.socio.findFirst({
          where: { matricula: vendaData.matricula },
        });

        if (!socio) {
          // Criar sócio se não existir
          socio = await prisma.socio.create({
            data: {
              matricula: vendaData.matricula,
              nome: vendaData.associado || 'Nome não informado',
              cpf: '',
              dataNascimento: new Date('1970-01-01'),
              telefone: '',
              email: '',
              endereco: '',
              cidade: '',
              cep: '',
              empresaId: empresaAspma.id,
            },
          });
        } else if (!socio.empresaId) {
          // Atualizar empresa se não tiver
          socio = await prisma.socio.update({
            where: { id: socio.id },
            data: { empresaId: empresaAspma.id },
          });
        }

        // Buscar ou criar convênio
        let convenio = await prisma.convenio.findFirst({
          where: { codigo: vendaData.codconven },
        });

        if (!convenio) {
          convenio = await prisma.convenio.create({
            data: {
              codigo: vendaData.codconven,
              razao_soc: vendaData.conveniado || 'Convênio não informado',
            },
          });
        }

        // Buscar venda existente usando numeroVenda CORRETO (sequencia)
        let venda = await prisma.venda.findFirst({
          where: {
            socioId: socio.id,
            numeroVenda: vendaData.numeroVenda,
          },
        });

        if (!venda) {
          // Criar venda com numeroVenda = sequencia do MySQL
          const valorTotal = vendaData.parcelas.reduce(
            (sum: number, p: any) => sum + parseFloat(p.valor || '0'),
            0
          );

          venda = await prisma.venda.create({
            data: {
              socioId: socio.id,
              convenioId: convenio.id,
              numeroVenda: vendaData.numeroVenda,
              dataEmissao: new Date(),
              valorParcela: valorTotal / vendaData.parcelas.length,
              valorTotal: valorTotal,
              quantidadeParcelas: vendaData.parcelas.length,
            },
          });

          stats.vendasCriadas++;
        } else {
          // Venda já existe - verificar se precisa atualizar convênio
          if (!venda.convenioId || venda.convenioId !== convenio.id) {
            venda = await prisma.venda.update({
              where: { id: venda.id },
              data: { convenioId: convenio.id },
            });
            stats.vendasAtualizadas++;
          } else {
            stats.vendasIgnoradas++;
          }
        }

        // Processar parcelas
        for (const parcelaData of vendaData.parcelas) {
          const numeroParcela = parseInt(parcelaData.nrseq) || 1;
          const valor = parseFloat(parcelaData.valor || '0');
          const dataVencimento = new Date(parcelaData.vencimento);
          
          // ✅ CORREÇÃO: Lógica de baixa correta (string vazia vs preenchida)
          const baixa = parcelaData.baixa && parcelaData.baixa.trim() !== '' 
            ? parcelaData.baixa.trim() 
            : '';

          // Verificar se parcela já existe
          let parcela = await prisma.parcela.findFirst({
            where: {
              vendaId: venda.id,
              numeroParcela: numeroParcela,
            },
          });

          if (!parcela) {
            // Criar parcela
            await prisma.parcela.create({
              data: {
                vendaId: venda.id,
                numeroParcela: numeroParcela,
                valor: valor,
                dataVencimento: dataVencimento,
                baixa: baixa,
                dataBaixa: baixa !== '' ? dataVencimento : null,
              },
            });

            stats.parcelasCriadas++;
          } else {
            // Atualizar se necessário
            const precisaAtualizar =
              parcela.baixa !== baixa ||
              Math.abs(parcela.valor.toNumber() - valor) > 0.01 ||
              parcela.dataVencimento.getTime() !== dataVencimento.getTime();

            if (precisaAtualizar) {
              await prisma.parcela.update({
                where: { id: parcela.id },
                data: {
                  baixa: baixa,
                  valor: valor,
                  dataVencimento: dataVencimento,
                  dataBaixa: baixa !== '' ? (parcela.dataBaixa || dataVencimento) : null,
                },
              });

              stats.parcelasAtualizadas++;
            } else {
              stats.parcelasIgnoradas++;
            }
          }
        }
      } catch (error) {
        const errorMsg = `Erro ao processar venda ${vendaData.numeroVenda} (Mat ${vendaData.matricula}): ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.erros.push(errorMsg);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. RESUMO
    // ══════════════════════════════════════════════════════════════════
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  RESUMO DA MIGRAÇÃO');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📊 VENDAS:\n');
    console.log(`   Analisadas:  ${stats.vendasAnalisadas.toLocaleString()}`);
    console.log(`   Criadas:     ${stats.vendasCriadas.toLocaleString()}`);
    console.log(`   Atualizadas: ${stats.vendasAtualizadas.toLocaleString()}`);
    console.log(`   Ignoradas:   ${stats.vendasIgnoradas.toLocaleString()}\n`);

    console.log('📊 PARCELAS:\n');
    console.log(`   Criadas:     ${stats.parcelasCriadas.toLocaleString()}`);
    console.log(`   Atualizadas: ${stats.parcelasAtualizadas.toLocaleString()}`);
    console.log(`   Ignoradas:   ${stats.parcelasIgnoradas.toLocaleString()}\n`);

    if (stats.erros.length > 0) {
      console.log(`❌ ERROS: ${stats.erros.length}\n`);
      stats.erros.slice(0, 10).forEach((erro) => {
        console.log(`   • ${erro}`);
      });
      if (stats.erros.length > 10) {
        console.log(`   ... e mais ${stats.erros.length - 10} erros\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  VALIDAÇÃO RECOMENDADA');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Execute os scripts de validação:\n');
    console.log('   npx tsx app/scripts/calcular-diferenca-exata-pensionistas.ts');
    console.log('   npx tsx app/scripts/investigar-vendas-nao-reconhecidas.ts\n');

  } finally {
    await mysqlConn.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✅ Migração concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    console.error(error);
    process.exit(1);
  });

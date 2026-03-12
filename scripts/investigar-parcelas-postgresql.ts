/**
 * INVESTIGAÇÃO: Por que as parcelas não estão no PostgreSQL?
 * 
 * Verifica se:
 * 1. Parcelas existem mas com vencimento diferente
 * 2. Parcelas existem mas com baixa preenchida
 * 3. Parcelas simplesmente não foram migradas
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

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  INVESTIGAÇÃO: Parcelas Faltantes no PostgreSQL');
  console.log('═══════════════════════════════════════════════════════════\n');

  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // Pegar matrícula 8170 como exemplo (tem 3 parcelas no MySQL)
    const matricula = '8170';

    console.log(`🔍 Analisando matrícula ${matricula}...\n`);

    // ══════════════════════════════════════════════════════════════════
    // 1. BUSCAR PARCELAS NO MYSQL
    // ══════════════════════════════════════════════════════════════════
    const [parcelasMySQL] = await mysqlConn.execute(`
      SELECT 
        TRIM(p.matricula) as matricula,
        TRIM(p.sequencia) as sequencia,
        TRIM(p.nrseq) as nrseq,
        p.vencimento,
        p.valor,
        TRIM(p.baixa) as baixa,
        TRIM(p.associado) as associado,
        TRIM(p.codconven) as codconven
      FROM parcelas p
      WHERE TRIM(p.matricula) = ?
        AND YEAR(p.vencimento) = 2026 
        AND MONTH(p.vencimento) = 3
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
      ORDER BY p.sequencia, p.nrseq
    `, [matricula]);

    console.log(`📦 MySQL tem ${(parcelasMySQL as any[]).length} parcelas:\n`);

    (parcelasMySQL as any[]).forEach((p: any) => {
      console.log(`   Seq ${p.sequencia} Parcela ${p.nrseq}:`);
      console.log(`      Vencimento: ${p.vencimento}`);
      console.log(`      Valor: R$ ${p.valor}`);
      console.log(`      Baixa: "${p.baixa}"`);
      console.log(`      Convênio: ${p.codconven}\n`);
    });

    // ══════════════════════════════════════════════════════════════════
    // 2. BUSCAR SÓCIO NO POSTGRESQL
    // ══════════════════════════════════════════════════════════════════
    const socio = await prisma.socio.findFirst({
      where: { matricula },
    });

    if (!socio) {
      console.log(`❌ Sócio ${matricula} não encontrado no PostgreSQL!\n`);
      return;
    }

    console.log(`✓ Sócio encontrado: ${socio.nome} (ID: ${socio.id})\n`);

    // ══════════════════════════════════════════════════════════════════
    // 3. BUSCAR VENDAS NO POSTGRESQL
    // ══════════════════════════════════════════════════════════════════
    const vendas = await prisma.venda.findMany({
      where: { socioId: socio.id },
      include: {
        parcelas: true,
      },
    });

    console.log(`📦 PostgreSQL tem ${vendas.length} vendas:\n`);

    vendas.forEach((v) => {
      console.log(`   Venda ${v.numeroVenda}:`);
      console.log(`      Convênio: ${v.convenioId}`);
      console.log(`      Total de parcelas: ${v.parcelas.length}\n`);
    });

    // ══════════════════════════════════════════════════════════════════
    // 4. BUSCAR PARCELAS DAS VENDAS DO MYSQL NO POSTGRESQL
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  COMPARAÇÃO PARCELA POR PARCELA');
    console.log('═══════════════════════════════════════════════════════════\n');

    const parcelasMySQLArray = parcelasMySQL as any[];

    for (const parcelaMySQL of parcelasMySQLArray) {
      console.log(`┌─── Seq ${parcelaMySQL.sequencia} Parcela ${parcelaMySQL.nrseq} ───────────────────────┐\n`);

      // Buscar venda correspondente no PostgreSQL
      const venda = vendas.find((v) => String(v.numeroVenda) === String(parcelaMySQL.sequencia));

      if (!venda) {
        console.log(`   ❌ Venda ${parcelaMySQL.sequencia} NÃO encontrada no PostgreSQL!\n`);
        continue;
      }

      console.log(`   ✓ Venda ${venda.numeroVenda} encontrada (ID: ${venda.id})\n`);

      // Buscar parcela específica
      const parcela = venda.parcelas.find(
        (p) => String(p.numeroParcela) === String(parcelaMySQL.nrseq)
      );

      if (!parcela) {
        console.log(`   ❌ Parcela ${parcelaMySQL.nrseq} NÃO encontrada no PostgreSQL!\n`);
        console.log(`      Parcelas disponíveis: ${venda.parcelas.map((p) => p.numeroParcela).join(', ')}\n`);
        continue;
      }

      console.log(`   ✓ Parcela ${parcela.numeroParcela} encontrada (ID: ${parcela.id})\n`);

      // Comparar dados
      const vencimentoMySQL = new Date(parcelaMySQL.vencimento);
      const vencimentoPG = new Date(parcela.dataVencimento);

      console.log(`   📅 Vencimento:`);
      console.log(`      MySQL:      ${vencimentoMySQL.toISOString().split('T')[0]}`);
      console.log(`      PostgreSQL: ${vencimentoPG.toISOString().split('T')[0]}`);
      console.log(`      Iguais? ${vencimentoMySQL.toISOString().split('T')[0] === vencimentoPG.toISOString().split('T')[0] ? '✓' : '❌'}\n`);

      console.log(`   💰 Valor:`);
      console.log(`      MySQL:      R$ ${parcelaMySQL.valor}`);
      console.log(`      PostgreSQL: R$ ${parcela.valor}`);
      console.log(`      Iguais? ${Math.abs(parcelaMySQL.valor - parcela.valor) < 0.01 ? '✓' : '❌'}\n`);

      console.log(`   📝 Baixa:`);
      console.log(`      MySQL:      "${parcelaMySQL.baixa}"`);
      console.log(`      PostgreSQL: "${parcela.baixa}"`);
      console.log(`      Iguais? ${parcelaMySQL.baixa === parcela.baixa ? '✓' : '❌'}\n`);

      // Verificar se parcela seria encontrada pela query do relatório
      const mesmoMes = vencimentoPG.getMonth() === 2; // Março = 2 (0-indexed)
      const mesmoAno = vencimentoPG.getFullYear() === 2026;
      const baixaVazia = parcela.baixa === '';

      console.log(`   🔍 Seria encontrada pela query do relatório?`);
      console.log(`      Mês = Março? ${mesmoMes ? '✓' : '❌'} (${vencimentoPG.getMonth() + 1})`);
      console.log(`      Ano = 2026? ${mesmoAno ? '✓' : '❌'} (${vencimentoPG.getFullYear()})`);
      console.log(`      Baixa vazia? ${baixaVazia ? '✓' : '❌'} ("${parcela.baixa}")`);
      console.log(`      RESULTADO: ${mesmoMes && mesmoAno && baixaVazia ? '✅ SIM' : '❌ NÃO'}\n`);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. BUSCAR TODAS AS PARCELAS NO POSTGRESQL (sem filtro de data)
    // ══════════════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TODAS AS PARCELAS NO POSTGRESQL (sem filtro)');
    console.log('═══════════════════════════════════════════════════════════\n');

    const todasParcelas = await prisma.parcela.findMany({
      where: {
        venda: {
          socioId: socio.id,
        },
      },
      include: {
        venda: true,
      },
      orderBy: [{ venda: { numeroVenda: 'asc' } }, { numeroParcela: 'asc' }],
    });

    console.log(`📦 Total de parcelas no PostgreSQL: ${todasParcelas.length}\n`);

    const parcelasPorMesAno = todasParcelas.reduce((acc: any, p) => {
      const data = new Date(p.dataVencimento);
      const mesAno = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
      acc[mesAno] = (acc[mesAno] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Distribuição por mês/ano:\n');
    Object.entries(parcelasPorMesAno)
      .sort()
      .forEach(([mesAno, count]) => {
        console.log(`   ${mesAno}: ${count} parcelas`);
      });

    console.log('\n📊 Parcelas de Março/2026:\n');

    const parcelasMarco2026 = todasParcelas.filter((p) => {
      const data = new Date(p.dataVencimento);
      return data.getMonth() === 2 && data.getFullYear() === 2026;
    });

    console.log(`   Total: ${parcelasMarco2026.length} parcelas\n`);

    if (parcelasMarco2026.length > 0) {
      console.log(`   Detalhes:\n`);
      parcelasMarco2026.forEach((p) => {
        console.log(`      Venda ${p.venda.numeroVenda} Parcela ${p.numeroParcela}:`);
        console.log(`         Vencimento: ${new Date(p.dataVencimento).toISOString().split('T')[0]}`);
        console.log(`         Valor: R$ ${p.valor}`);
        console.log(`         Baixa: "${p.baixa}"\n`);
      });
    }

    const parcelasMarco2026SemBaixa = parcelasMarco2026.filter((p) => p.baixa === '');

    console.log(`   📊 Parcelas de Março/2026 SEM baixa: ${parcelasMarco2026SemBaixa.length}\n`);

    if (parcelasMarco2026SemBaixa.length > 0) {
      console.log(`      ✅ ENCONTRADAS! Detalhes:\n`);
      parcelasMarco2026SemBaixa.forEach((p) => {
        console.log(`         Venda ${p.venda.numeroVenda} Parcela ${p.numeroParcela}`);
        console.log(`            Vencimento: ${new Date(p.dataVencimento).toISOString().split('T')[0]}`);
        console.log(`            Valor: R$ ${p.valor}\n`);
      });
    } else {
      console.log(`      ❌ NENHUMA encontrada!\n`);
    }
  } finally {
    await mysqlConn.end();
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✓ Investigação concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Erro:', error.message);
    console.error(error);
    process.exit(1);
  });

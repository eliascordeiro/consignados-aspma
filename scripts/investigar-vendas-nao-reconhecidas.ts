/**
 * INVESTIGAÇÃO: Por que vendas não foram reconhecidas?
 * 
 * Analisa as primeiras 10 matrículas de pensionistas e investiga:
 * 1. As vendas existem na tabela vendas do MySQL?
 * 2. Os sócios foram migrados para o PostgreSQL?
 * 3. As vendas foram criadas no PostgreSQL?
 * 4. Por que algumas vendas não foram reconhecidas?
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

interface ResultadoInvestigacao {
  matricula: string;
  associado: string;
  codtipo: string;
  vendasMySQL: number;
  socioMigrado: boolean;
  vendasPostgreSQL: number;
  parcelasMySQL: number;
  parcelasPostgreSQL: number;
  percentualMigrado: number;
  detalhes: string[];
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  INVESTIGAÇÃO: Vendas Não Reconhecidas');
  console.log('  Análise detalhada das primeiras 10 matrículas');
  console.log('═══════════════════════════════════════════════════════════\n');

  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    // ══════════════════════════════════════════════════════════════════
    // 1. BUSCAR PARCELAS DE PENSIONISTAS NO MYSQL (primeiras 10 matrículas)
    // ══════════════════════════════════════════════════════════════════
    console.log('📦 1. Buscando parcelas de pensionistas (MySQL)...\n');

    const [parcelasMySQL] = await mysqlConn.execute(`
      SELECT DISTINCT
        TRIM(p.matricula) as matricula
      FROM parcelas p
      LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
      WHERE YEAR(p.vencimento) = 2026 
        AND MONTH(p.vencimento) = 3
        AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
        AND (s.codtipo = '3' OR s.codtipo = '4')
      LIMIT 10
    `);

    const matriculasParaInvestigar = (parcelasMySQL as any[]).map((p: any) => p.matricula);
    console.log(`✓ Selecionadas ${matriculasParaInvestigar.length} matrículas para investigação\n`);
    console.log(`   Matrículas: ${matriculasParaInvestigar.join(', ')}\n`);

    const resultados: ResultadoInvestigacao[] = [];

    // ══════════════════════════════════════════════════════════════════
    // 2. PARA CADA MATRÍCULA, INVESTIGAR DETALHADAMENTE
    // ══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  INVESTIGAÇÃO INDIVIDUAL POR MATRÍCULA');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (let idx = 0; idx < matriculasParaInvestigar.length; idx++) {
      const matricula = matriculasParaInvestigar[idx];
      const detalhes: string[] = [];

      console.log(`\n┌─────────────────────────────────────────────────────────┐`);
      console.log(`│ MATRÍCULA ${idx + 1}/10: ${matricula.padEnd(8)} ${' '.repeat(36)}│`);
      console.log(`└─────────────────────────────────────────────────────────┘\n`);

      // Buscar dados do sócio no MySQL
      const [socioMySQL] = await mysqlConn.execute(`
        SELECT 
          TRIM(matricula) as matricula,
          TRIM(associado) as associado,
          TRIM(codtipo) as codtipo,
          TRIM(cpf) as cpf
        FROM socios
        WHERE TRIM(matricula) = ?
      `, [matricula]);

      const socio = (socioMySQL as any[])[0];

      if (!socio) {
        console.log(`   ❌ Sócio não encontrado no MySQL!\n`);
        continue;
      }

      console.log(`   Nome: ${socio.associado}`);
      console.log(`   Tipo: ${socio.codtipo} (${socio.codtipo === '3' ? 'Pensionista' : 'Outro'})`);
      console.log(`   CPF: ${socio.cpf}\n`);

      // Buscar vendas no MySQL
      const [vendasMySQL] = await mysqlConn.execute(`
        SELECT 
          v.matricula,
          v.sequencia,
          v.emissao,
          v.codconven,
          v.parcelas,
          v.valorparcela
        FROM vendas v
        WHERE v.matricula = ?
        ORDER BY v.sequencia
      `, [Number(matricula)]);

      const vendas = vendasMySQL as any[];
      console.log(`   📊 Vendas no MySQL: ${vendas.length}`);

      if (vendas.length > 0) {
        console.log(`      Sequências: ${vendas.map((v: any) => v.sequencia).join(', ')}`);
        console.log(`      Convênios: ${[...new Set(vendas.map((v: any) => v.codconven))].join(', ')}`);
        detalhes.push(`MySQL tem ${vendas.length} vendas`);
      } else {
        detalhes.push('Nenhuma venda no MySQL');
      }

      // Buscar parcelas no MySQL para essa matrícula
      const [parcelasMatriculaMySQL] = await mysqlConn.execute(`
        SELECT COUNT(*) as total
        FROM parcelas p
        WHERE TRIM(p.matricula) = ?
          AND YEAR(p.vencimento) = 2026 
          AND MONTH(p.vencimento) = 3
          AND (TRIM(p.baixa) = '' OR p.baixa IS NULL)
      `, [matricula]);

      const totalParcelasMySQL = (parcelasMatriculaMySQL as any[])[0].total;
      console.log(`   📊 Parcelas no MySQL (Mar/2026): ${totalParcelasMySQL}\n`);

      // Verificar se sócio foi migrado para PostgreSQL
      const socioPostgreSQL = await prisma.socio.findFirst({
        where: {
          matricula: matricula,
        },
      });

      const socioMigrado = !!socioPostgreSQL;
      console.log(`   ${socioMigrado ? '✓' : '❌'} Sócio migrado para PostgreSQL: ${socioMigrado ? 'SIM' : 'NÃO'}`);

      if (socioMigrado) {
        detalhes.push('Sócio migrado');
        console.log(`      ID PostgreSQL: ${socioPostgreSQL.id}`);
        console.log(`      Nome: ${socioPostgreSQL.nome}`);
        console.log(`      Tipo: ${socioPostgreSQL.codTipo}\n`);

        // Buscar vendas criadas no PostgreSQL
        const vendasPostgreSQL = await prisma.venda.findMany({
          where: {
            socioId: socioPostgreSQL.id,
          },
          include: {
            parcelas: {
              where: {
                baixa: '',
                dataVencimento: {
                  gte: new Date('2026-03-01'),
                  lt: new Date('2026-04-01'),
                },
              },
            },
          },
        });

        console.log(`   📊 Vendas no PostgreSQL: ${vendasPostgreSQL.length}`);

        if (vendasPostgreSQL.length > 0) {
          console.log(`      Números: ${vendasPostgreSQL.map((v: any) => v.numeroVenda).join(', ')}`);
          console.log(`      Convênios: ${[...new Set(vendasPostgreSQL.map((v: any) => v.convenioId))].join(', ')}`);
          detalhes.push(`PostgreSQL tem ${vendasPostgreSQL.length} vendas`);

          const totalParcelasPostgreSQL = vendasPostgreSQL.reduce(
            (sum, v) => sum + v.parcelas.length,
            0
          );

          console.log(`   📊 Parcelas no PostgreSQL (Mar/2026): ${totalParcelasPostgreSQL}\n`);

          const percentual =
            totalParcelasMySQL > 0
              ? Math.round((totalParcelasPostgreSQL / totalParcelasMySQL) * 100)
              : 0;

          console.log(`   📈 Taxa de migração: ${percentual}% (${totalParcelasPostgreSQL}/${totalParcelasMySQL})\n`);

          if (percentual < 100) {
            detalhes.push(
              `PARCIALMENTE MIGRADO: ${totalParcelasPostgreSQL}/${totalParcelasMySQL} (${percentual}%)`
            );

            // Investigar QUAL VENDA não foi migrada
            console.log(`   🔍 INVESTIGANDO VENDAS FALTANTES:\n`);

            const sequenciasMySQL = new Set(vendas.map((v: any) => String(v.sequencia)));
            const sequenciasPostgreSQL = new Set(
              vendasPostgreSQL.map((v: any) => String(v.numeroVenda))
            );

            const sequenciasFaltantes = [...sequenciasMySQL].filter(
              (seq) => !sequenciasPostgreSQL.has(seq)
            );

            if (sequenciasFaltantes.length > 0) {
              console.log(`      ❌ Sequências não migradas: ${sequenciasFaltantes.join(', ')}\n`);

              for (const seqFaltante of sequenciasFaltantes) {
                const vendaFaltante = vendas.find((v: any) => String(v.sequencia) === seqFaltante);

                if (vendaFaltante) {
                  console.log(`         Sequência ${seqFaltante}:`);
                  console.log(`            Emissão: ${vendaFaltante.emissao}`);
                  console.log(`            Convênio: ${vendaFaltante.codconven}`);
                  console.log(`            Parcelas: ${vendaFaltante.parcelas}`);
                  console.log(`            Valor parcela: R$ ${vendaFaltante.valorparcela}\n`);

                  detalhes.push(`Seq ${seqFaltante} não migrada (Conv ${vendaFaltante.codconven})`);
                }
              }
            }
          } else {
            detalhes.push('100% MIGRADO');
          }

          resultados.push({
            matricula,
            associado: socio.associado,
            codtipo: socio.codtipo,
            vendasMySQL: vendas.length,
            socioMigrado: true,
            vendasPostgreSQL: vendasPostgreSQL.length,
            parcelasMySQL: totalParcelasMySQL,
            parcelasPostgreSQL: totalParcelasPostgreSQL,
            percentualMigrado: percentual,
            detalhes,
          });
        } else {
          console.log(`   ❌ Nenhuma venda criada no PostgreSQL!\n`);
          detalhes.push('SÓCIO MIGRADO mas SEM VENDAS');

          resultados.push({
            matricula,
            associado: socio.associado,
            codtipo: socio.codtipo,
            vendasMySQL: vendas.length,
            socioMigrado: true,
            vendasPostgreSQL: 0,
            parcelasMySQL: totalParcelasMySQL,
            parcelasPostgreSQL: 0,
            percentualMigrado: 0,
            detalhes,
          });
        }
      } else {
        console.log(`   ❌ Sócio NÃO foi migrado - impossível ter vendas!\n`);
        detalhes.push('SÓCIO NÃO MIGRADO');

        resultados.push({
          matricula,
          associado: socio.associado,
          codtipo: socio.codtipo,
          vendasMySQL: vendas.length,
          socioMigrado: false,
          vendasPostgreSQL: 0,
          parcelasMySQL: totalParcelasMySQL,
          parcelasPostgreSQL: 0,
          percentualMigrado: 0,
          detalhes,
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. RESUMO CONSOLIDADO
    // ══════════════════════════════════════════════════════════════════
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  RESUMO DA INVESTIGAÇÃO');
    console.log('═══════════════════════════════════════════════════════════\n');

    const sociosNaoMigrados = resultados.filter((r) => !r.socioMigrado);
    const sociosMigradosSemVendas = resultados.filter(
      (r) => r.socioMigrado && r.vendasPostgreSQL === 0
    );
    const sociosParcialmenteMigrados = resultados.filter(
      (r) => r.socioMigrado && r.percentualMigrado > 0 && r.percentualMigrado < 100
    );
    const sociosTotalmenteMigrados = resultados.filter(
      (r) => r.socioMigrado && r.percentualMigrado === 100
    );

    console.log('📊 CATEGORIAS:\n');
    console.log(`   ❌ Sócios NÃO migrados: ${sociosNaoMigrados.length}`);
    console.log(`   ⚠️  Sócios migrados mas SEM vendas: ${sociosMigradosSemVendas.length}`);
    console.log(`   🔶 Sócios PARCIALMENTE migrados: ${sociosParcialmenteMigrados.length}`);
    console.log(`   ✅ Sócios TOTALMENTE migrados: ${sociosTotalmenteMigrados.length}\n`);

    if (sociosNaoMigrados.length > 0) {
      console.log('\n❌ SÓCIOS NÃO MIGRADOS:\n');
      sociosNaoMigrados.forEach((r) => {
        console.log(`   Mat ${r.matricula} - ${r.associado}`);
        console.log(`      Tipo: ${r.codtipo}`);
        console.log(`      Vendas MySQL: ${r.vendasMySQL}`);
        console.log(`      Parcelas MySQL: ${r.parcelasMySQL}\n`);
      });
    }

    if (sociosMigradosSemVendas.length > 0) {
      console.log('\n⚠️  SÓCIOS MIGRADOS MAS SEM VENDAS:\n');
      sociosMigradosSemVendas.forEach((r) => {
        console.log(`   Mat ${r.matricula} - ${r.associado}`);
        console.log(`      Tipo: ${r.codtipo}`);
        console.log(`      Vendas MySQL: ${r.vendasMySQL}`);
        console.log(`      Parcelas MySQL: ${r.parcelasMySQL}\n`);
      });
    }

    if (sociosParcialmenteMigrados.length > 0) {
      console.log('\n🔶 SÓCIOS PARCIALMENTE MIGRADOS:\n');
      sociosParcialmenteMigrados.forEach((r) => {
        console.log(`   Mat ${r.matricula} - ${r.associado}`);
        console.log(`      Taxa: ${r.percentualMigrado}% (${r.parcelasPostgreSQL}/${r.parcelasMySQL})`);
        console.log(`      Detalhes: ${r.detalhes.join(' | ')}\n`);
      });
    }

    if (sociosTotalmenteMigrados.length > 0) {
      console.log('\n✅ SÓCIOS TOTALMENTE MIGRADOS:\n');
      sociosTotalmenteMigrados.forEach((r) => {
        console.log(`   Mat ${r.matricula} - ${r.associado} (${r.parcelasMySQL} parcelas)\n`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  PADRÕES IDENTIFICADOS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (sociosNaoMigrados.length > 0) {
      console.log('🔍 PADRÃO 1: Sócios não foram migrados');
      console.log('   → Causa raiz: tabela socios não foi completamente migrada');
      console.log('   → Solução: verificar script de migração de sócios\n');
    }

    if (sociosMigradosSemVendas.length > 0) {
      console.log('🔍 PADRÃO 2: Sócios migrados mas sem vendas');
      console.log('   → Causa raiz: tabela vendas não foi vinculada aos sócios');
      console.log('   → Solução: verificar script de migração de vendas\n');
    }

    if (sociosParcialmenteMigrados.length > 0) {
      console.log('🔍 PADRÃO 3: Sócios com migração parcial de vendas');
      console.log('   → Causa raiz: apenas ALGUMAS vendas foram migradas');
      console.log('   → Solução: investigar critério de filtragem no script de migração\n');
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

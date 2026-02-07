import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

const mysqlConfig = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma'
};

const railwayPrisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }
  }
});

async function verificarParcelas() {
  console.log('🔍 Verificando parcelas não migradas...\n');

  const mysqlConn = await mysql.createConnection(mysqlConfig);

  try {
    // 1. Contar totais
    const [[mysqlCount]] = await mysqlConn.query('SELECT COUNT(*) as total FROM parcelas') as any;
    const railwayCount = await railwayPrisma.parcela.count();

    console.log(`📊 MySQL:   ${mysqlCount.total.toLocaleString('pt-BR')} parcelas`);
    console.log(`📊 Railway: ${railwayCount.toLocaleString('pt-BR')} parcelas`);
    console.log(`❌ Diferença: ${(mysqlCount.total - railwayCount).toLocaleString('pt-BR')} parcelas\n`);

    // 2. Verificar range de IDs
    const [[mysqlRange]] = await mysqlConn.query('SELECT MIN(id) as minId, MAX(id) as maxId FROM parcelas') as any;
    console.log(`📍 Range de IDs no MySQL: ${mysqlRange.minId} - ${mysqlRange.maxId}`);
    console.log(`📏 Diferença de IDs: ${mysqlRange.maxId - mysqlRange.minId + 1}`);
    console.log(`📉 Gap estimado: ${(mysqlRange.maxId - mysqlRange.minId + 1) - mysqlCount.total} IDs\n`);

    // 3. Buscar parcelas do MySQL em batches e verificar se existem no Railway
    console.log('🔍 Amostrando parcelas não migradas (primeiras 20)...\n');

    const batchSize = 5000;
    let checked = 0;
    let missing = 0;
    const missingExamples: any[] = [];

    for (let offset = 0; offset < mysqlCount.total && missing < 20; offset += batchSize) {
      const [parcelas] = await mysqlConn.query(
        'SELECT id, matricula, sequencia, nrseq, vencimento, valor FROM parcelas ORDER BY id LIMIT ? OFFSET ?',
        [batchSize, offset]
      ) as any;

      for (const parcela of parcelas) {
        // Verificar se existe no Railway
        // Usar vendaId como chave (se venda existir)
        const vendaKey = `${parseInt(parcela.matricula)}-${parseInt(parcela.sequencia)}`;
        
        // Buscar venda no Railway
        const venda = await railwayPrisma.venda.findFirst({
          where: {
            numeroVenda: parseInt(parcela.sequencia)
          }
        });

        if (venda) {
          // Se venda existe, verificar se parcela existe
          const parcelaExists = await railwayPrisma.parcela.findFirst({
            where: {
              vendaId: venda.id,
              numeroParcela: parseInt(parcela.nrseq)
            }
          });

          if (!parcelaExists) {
            missing++;
            if (missing <= 20) {
              missingExamples.push({
                mysqlId: parcela.id,
                matricula: parcela.matricula,
                sequencia: parcela.sequencia,
                nrseq: parcela.nrseq,
                vencimento: parcela.vencimento,
                valor: parcela.valor,
                vendaId: venda.id
              });
            }
          }
        }

        checked++;
      }

      if (checked % 10000 === 0) {
        console.log(`   Verificadas: ${checked.toLocaleString('pt-BR')} parcelas...`);
      }
    }

    console.log(`\n✅ Verificação completa: ${checked.toLocaleString('pt-BR')} parcelas checadas`);
    console.log(`❌ Não encontradas: ${missing.toLocaleString('pt-BR')}\n`);

    if (missingExamples.length > 0) {
      console.log('📋 Exemplos de parcelas não migradas:');
      missingExamples.forEach(p => {
        console.log(`   MySQL ID: ${p.mysqlId} | Matrícula: ${p.matricula} | Seq: ${p.sequencia} | NrSeq: ${p.nrseq} | Valor: ${p.valor}`);
      });
    }

    // 4. Verificar distribuição de IDs
    console.log('\n📊 Distribuição de IDs (amostra):');
    const [idSample] = await mysqlConn.query('SELECT id FROM parcelas ORDER BY id LIMIT 100') as any;
    const gaps: number[] = [];
    for (let i = 1; i < idSample.length; i++) {
      const gap = idSample[i].id - idSample[i - 1].id;
      if (gap > 1) gaps.push(gap);
    }

    if (gaps.length > 0) {
      console.log(`   ⚠️  Detectados ${gaps.length} gaps nos primeiros 100 IDs`);
      console.log(`   📏 Gaps: ${gaps.slice(0, 10).join(', ')}${gaps.length > 10 ? '...' : ''}`);
    } else {
      console.log(`   ✅ IDs sequenciais (sem gaps detectados na amostra)`);
    }

  } finally {
    await mysqlConn.end();
    await railwayPrisma.$disconnect();
  }
}

verificarParcelas().catch(console.error);

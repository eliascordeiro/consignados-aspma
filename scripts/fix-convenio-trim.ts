import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';

// Força usar Railway
const RAILWAY_DATABASE_URL = 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';
process.env.DATABASE_URL = RAILWAY_DATABASE_URL;

const prisma = new PrismaClient();

interface MySQLVenda {
  id: number;
  matricula: string;
  sequencia: number;
  codconven: number;
}

const MYSQL_CONFIG = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
};

async function main() {
  console.log('🔧 CORREÇÃO: Vinculando convênios com TRIM\n');

  let mysqlConnection: mysql.Connection | null = null;

  try {
    // Conecta ao MySQL
    console.log('🔌 Conectando ao MySQL...');
    mysqlConnection = await mysql.createConnection(MYSQL_CONFIG);
    console.log('✅ Conectado ao MySQL\n');

    // ========== PASSO 1: TRIM nos códigos de convênio ==========
    console.log('📋 PASSO 1: Aplicando TRIM nos códigos de convênio...');
    const updateResult = await prisma.$executeRaw`
      UPDATE convenio 
      SET codigo = TRIM(codigo) 
      WHERE codigo != TRIM(codigo)
    `;
    console.log(`✅ ${updateResult} convênios atualizados com TRIM\n`);

    // ========== PASSO 2: Recarregar convênios com TRIM ==========
    console.log('📋 PASSO 2: Carregando convênios...');
    const convenios = await prisma.convenio.findMany({
      select: { id: true, codigo: true },
    });
    
    const convenioMap = new Map<string, number>();
    for (const conv of convenios) {
      if (conv.codigo) {
        const codigoTrim = conv.codigo.trim();
        convenioMap.set(codigoTrim, conv.id);
        
        // Também adiciona variações com espaços para compatibilidade
        convenioMap.set(conv.codigo, conv.id);
        convenioMap.set(`${codigoTrim} `, conv.id);
        convenioMap.set(` ${codigoTrim}`, conv.id);
        convenioMap.set(` ${codigoTrim} `, conv.id);
      }
    }
    console.log(`✅ ${convenioMap.size} entradas no mapa de convênios\n`);

    // ========== PASSO 3: Carregar vendas do MySQL com codconven ==========
    console.log('📋 PASSO 3: Carregando vendas do MySQL...');
    const [vendasMySQL] = await mysqlConnection.query<mysql.RowDataPacket[]>(
      'SELECT matricula, sequencia, codconven FROM vendas WHERE codconven IS NOT NULL AND codconven != 0'
    );
    console.log(`✅ ${vendasMySQL.length} vendas com codconven no MySQL\n`);

    // ========== PASSO 4: Criar mapa de vendas Railway ==========
    console.log('📋 PASSO 4: Carregando vendas do Railway...');
    const vendasRailway = await prisma.venda.findMany({
      select: {
        id: true,
        numeroVenda: true,
        socio: {
          select: { matricula: true }
        }
      }
    });

    const vendaRailwayMap = new Map<string, string>();
    for (const venda of vendasRailway) {
      if (venda.socio.matricula) {
        const key = `${venda.socio.matricula.trim()}-${venda.numeroVenda}`;
        vendaRailwayMap.set(key, venda.id);
      }
    }
    console.log(`✅ ${vendaRailwayMap.size} vendas carregadas do Railway\n`);

    // ========== PASSO 5: Atualizar convenioId em lotes ==========
    console.log('📦 PASSO 5: Atualizando convenioId em lotes...\n');
    let atualizadas = 0;
    let naoEncontradas = 0;
    let semConvenio = 0;
    const BATCH_SIZE = 100;
    const updates: Array<{ vendaId: string, convenioId: number }> = [];

    for (const vendaMySQL of vendasMySQL as MySQLVenda[]) {
      const matriculaStr = vendaMySQL.matricula?.toString().trim();
      const sequencia = vendaMySQL.sequencia;
      const codconvenStr = vendaMySQL.codconven?.toString().trim();

      // Busca venda no Railway
      const key = `${matriculaStr}-${sequencia}`;
      const vendaRailwayId = vendaRailwayMap.get(key);

      if (!vendaRailwayId) {
        naoEncontradas++;
        continue;
      }

      // Busca convênio
      const convenioId = convenioMap.get(codconvenStr);
      if (!convenioId) {
        semConvenio++;
        continue;
      }

      // Adiciona ao lote
      updates.push({ vendaId: vendaRailwayId, convenioId });

      // Executa batch quando atingir o tamanho
      if (updates.length >= BATCH_SIZE) {
        for (const update of updates) {
          await prisma.venda.update({
            where: { id: update.vendaId },
            data: { convenioId: update.convenioId },
          });
          atualizadas++;
        }
        
        console.log(`  ✅ ${atualizadas} vendas atualizadas...`);
        updates.length = 0; // Limpa o array
      }
    }

    // Processa últimas atualizações
    if (updates.length > 0) {
      for (const update of updates) {
        await prisma.venda.update({
          where: { id: update.vendaId },
          data: { convenioId: update.convenioId },
        });
        atualizadas++;
      }
    }

    console.log('\n✅ CORREÇÃO CONCLUÍDA!\n');
    console.log(`📊 Estatísticas:`);
    console.log(`   • Vendas atualizadas: ${atualizadas}`);
    console.log(`   • Vendas não encontradas: ${naoEncontradas}`);
    console.log(`   • Convênios não encontrados: ${semConvenio}`);

    // Verifica resultado final
    const [resultado] = await prisma.$queryRaw<Array<{ com_convenio: bigint, sem_convenio: bigint }>>`
      SELECT 
        COUNT(CASE WHEN "convenioId" IS NOT NULL THEN 1 END) as com_convenio,
        COUNT(CASE WHEN "convenioId" IS NULL THEN 1 END) as sem_convenio
      FROM vendas
    `;

    console.log(`\n📈 Resultado Final:`);
    console.log(`   • Vendas COM convênio: ${resultado[0].com_convenio}`);
    console.log(`   • Vendas SEM convênio: ${resultado[0].sem_convenio}`);

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

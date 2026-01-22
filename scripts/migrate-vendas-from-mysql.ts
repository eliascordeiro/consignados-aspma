import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

// FORÇA conexão com Railway
process.env.DATABASE_URL = 'postgres://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';

const prisma = new PrismaClient();

// Configuração MySQL
const mysqlConfig = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma',
};

// Tamanho do lote para processamento
const BATCH_SIZE = 100;

interface MySQLVenda {
  id: number;
  matricula: string | null;
  sequencia: number | null;
  emissao: Date | null;
  associado: string | null;
  codconven: number | null;
  conveniado: string | null;
  parcelas: number | null;
  autorizado: string | null;
  operador: string | null;
  valorparcela: number | null;
  cancela: string | null;
}

interface MySQLParcela {
  id: number;
  matricula: string | null;
  sequencia: number | null;
  nrseq: number | null;
  vencimento: Date | null;
  valor: number | null;
  baixa: Date | null;
  associado: string | null;
  codconven: number | null;
  conveniado: string | null;
  parcelas: number | null;
  tipo: string | null;
}

async function migrateVendas() {
  console.log('🚀 Iniciando migração de vendas e parcelas do MySQL para Railway...\n');

  let mysqlConnection: mysql.Connection | null = null;

  try {
    // Conecta ao MySQL
    console.log('📡 Conectando ao MySQL remoto...');
    mysqlConnection = await mysql.createConnection(mysqlConfig);
    console.log('✅ Conectado ao MySQL\n');

    // Busca o userId do MANAGER principal no Railway
    console.log('👤 Buscando usuário MANAGER no Railway...');
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
    
    // Testa conexão Prisma
    const testConn = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Conexão Prisma OK:', testConn);
    
    const manager = await prisma.users.findUnique({
      where: { email: 'elias157508@gmail.com' },
    });

    if (!manager) {
      // Lista todos os usuários para debug
      const allUsers = await prisma.users.findMany({
        select: { id: true, email: true, name: true, role: true },
      });
      console.log('Usuários encontrados no Railway:', allUsers);
      throw new Error('Usuário elias157508@gmail.com não encontrado no Railway');
    }
    console.log(`✅ Manager encontrado: ${manager.name} (${manager.email}) - Role: ${manager.role}\n`);

    // Busca mapeamento de sócios (matricula -> id)
    console.log('📋 Carregando mapeamento de sócios...');
    const socios = await prisma.socio.findMany({
      where: { userId: manager.id },
      select: { id: true, matricula: true },
    });
    const socioMap = new Map(socios.map(s => [s.matricula, s.id]));
    console.log(`✅ ${socios.length} sócios carregados`);
    console.log(`Exemplos de matrículas: ${Array.from(socioMap.keys()).slice(0, 5).join(', ')}\n`);

    // Busca mapeamento de convênios (codigo -> id)
    console.log('📋 Carregando mapeamento de convênios...');
    const convenios = await prisma.convenio.findMany({
      select: { id: true, codigo: true },
    });
    const convenioMap = new Map(convenios.map(c => [c.codigo?.toString(), c.id]));
    console.log(`✅ ${convenios.length} convênios carregados\n`);

    // Conta registros no MySQL
    const [countResult] = await mysqlConnection.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM vendas'
    );
    const totalVendas = countResult[0].total;
    console.log(`📊 Total de vendas no MySQL: ${totalVendas}\n`);

    // Limpa tabelas no Railway (se houver dados)
    console.log('🗑️  Limpando tabelas de vendas no Railway...');
    await prisma.parcela.deleteMany({});
    await prisma.venda.deleteMany({});
    console.log('✅ Tabelas limpas\n');

    // Processa vendas em lotes
    console.log('📦 Iniciando migração de vendas...\n');
    let lastId = 0;
    let totalMigradas = 0;
    let totalPuladas = 0;
    const vendasMap = new Map<string, string>(); // MySQL ID -> Railway ID
    let hasMore = true;

    while (hasMore) {
      const [vendas] = await mysqlConnection.query<mysql.RowDataPacket[]>(
        `SELECT * FROM vendas WHERE id > ${lastId} ORDER BY id LIMIT ${BATCH_SIZE}`
      );

      if (vendas.length === 0) {
        hasMore = false;
        break;
      }

      for (const venda of vendas as MySQLVenda[]) {
        try {
          // Atualiza lastId
          lastId = venda.id;

          // Valida campos obrigatórios
          if (!venda.matricula || !venda.sequencia) {
            totalPuladas++;
            continue;
          }

          // Busca sócio - converte matricula para string se for número
          const matriculaStr = venda.matricula?.toString();
          const socioId = socioMap.get(matriculaStr);
          if (!socioId) {
            // Debug: log primeira vez que não encontra
            if (totalPuladas < 5) {
              console.log(`\n⚠️  Sócio não encontrado: matrícula="${matriculaStr}" (tipo: ${typeof venda.matricula})`);
            }
            totalPuladas++;
            continue;
          }

          // Busca convênio (se houver)
          let convenioId: number | null = null;
          if (venda.codconven) {
            convenioId = convenioMap.get(venda.codconven.toString()) || null;
          }

          // Cria venda no Railway
          const vendaCriada = await prisma.venda.create({
            data: {
              userId: manager.id,
              socioId,
              convenioId: convenioId,
              numeroVenda: venda.sequencia,
              dataEmissao: venda.emissao || new Date(),
              operador: venda.operador || venda.autorizado || 'Sistema',
              observacoes: venda.conveniado || null,
              quantidadeParcelas: venda.parcelas || 0,
              valorParcela: venda.valorparcela || 0,
              valorTotal: (venda.valorparcela || 0) * (venda.parcelas || 0),
              ativo: venda.cancela !== 'S',
              cancelado: venda.cancela === 'S',
              motivoCancelamento: venda.cancela === 'S' ? 'Cancelado no sistema antigo' : null,
            },
          });

          // Mapeia ID do MySQL para ID do Railway
          const mysqlKey = `${venda.matricula}-${venda.sequencia}`;
          vendasMap.set(mysqlKey, vendaCriada.id);
          totalMigradas++;
        } catch (error: any) {
          console.error(`❌ Erro ao migrar venda ${venda.id}:`, error.message);
          totalPuladas++;
        }
      }

      const progresso = Math.min(((totalMigradas + totalPuladas) / totalVendas) * 100, 100).toFixed(1);
      process.stdout.write(`\r⏳ Progresso: ${progresso}% (${totalMigradas} migradas, ${totalPuladas} puladas)`);
    }

    console.log(`\n✅ Vendas migradas: ${totalMigradas}\n`);

    // Agora migra as parcelas
    const [parcelasCount] = await mysqlConnection.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM parcelas'
    );
    const totalParcelas = parcelasCount[0].total;
    console.log(`📊 Total de parcelas no MySQL: ${totalParcelas}\n`);

    console.log('📦 Iniciando migração de parcelas...\n');
    let lastParcelaId = 0;
    let totalParcelasMigradas = 0;
    let totalParcelasPuladas = 0;
    hasMore = true;

    while (hasMore) {
      const [parcelas] = await mysqlConnection.query<mysql.RowDataPacket[]>(
        `SELECT * FROM parcelas WHERE id > ${lastParcelaId} ORDER BY id LIMIT ${BATCH_SIZE * 5}`
      );

      if (parcelas.length === 0) {
        hasMore = false;
        break;
      }

      for (const parcela of parcelas as MySQLParcela[]) {
        try {
          // Atualiza lastParcelaId
          lastParcelaId = parcela.id;

          // Valida campos obrigatórios
          if (!parcela.matricula || !parcela.sequencia || !parcela.nrseq) {
            totalParcelasPuladas++;
            continue;
          }

          // Busca venda no Railway
          const mysqlKey = `${parcela.matricula}-${parcela.sequencia}`;
          const vendaId = vendasMap.get(mysqlKey);

          if (!vendaId) {
            totalParcelasPuladas++;
            continue;
          }

          // Cria parcela no Railway
          await prisma.parcela.create({
            data: {
              vendaId,
              numeroParcela: parcela.nrseq,
              dataVencimento: parcela.vencimento || new Date(),
              valor: parcela.valor || 0,
              baixa: parcela.baixa ? true : false,
              dataBaixa: parcela.baixa || null,
              valorPago: parcela.baixa ? (parcela.valor || 0) : null,
              tipo: parcela.tipo || null,
              observacoes: null,
            },
          });

          totalParcelasMigradas++;
        } catch (error: any) {
          console.error(`❌ Erro ao migrar parcela ${parcela.id}:`, error.message);
          totalParcelasPuladas++;
        }
      }

      const progresso = Math.min(((totalParcelasMigradas + totalParcelasPuladas) / totalParcelas) * 100, 100).toFixed(1);
      process.stdout.write(`\r⏳ Progresso: ${progresso}% (${totalParcelasMigradas} migradas, ${totalParcelasPuladas} puladas)`);
    }

    console.log(`\n✅ Parcelas migradas: ${totalParcelasMigradas}\n`);

    console.log('\n✨ Migração concluída com sucesso!\n');
    console.log('📊 Resumo:');
    console.log(`  Vendas migradas: ${totalMigradas} de ${totalVendas}`);
    console.log(`  Parcelas migradas: ${totalParcelasMigradas} de ${totalParcelas}`);

  } catch (error: any) {
    console.error('\n❌ Erro na migração:', error.message);
    throw error;
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
    }
    await prisma.$disconnect();
  }
}

migrateVendas();

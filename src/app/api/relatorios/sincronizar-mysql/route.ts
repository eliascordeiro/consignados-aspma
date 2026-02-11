import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import { auth } from '@/lib/auth';
import { getDataUserId } from '@/lib/get-data-user-id';

const prisma = new PrismaClient();

interface SyncResult {
  vendasMigradas: number;
  parcelasMigradas: number;
  erros: string[];
  detalhes: {
    vendasNovas: number;
    parcelasNovas: number;
    parcelasAtualizadas: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const result: SyncResult = {
    vendasMigradas: 0,
    parcelasMigradas: 0,
    erros: [],
    detalhes: {
      vendasNovas: 0,
      parcelasNovas: 0,
      parcelasAtualizadas: 0,
    },
  };

  let connection: mysql.Connection | null = null;

  try {
    // Verificar autenticação
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const userId = await getDataUserId(session as any);

    const body = await request.json();
    const { mesAno, convenioId } = body;

    if (!mesAno) {
      return NextResponse.json(
        { error: 'Parâmetro mesAno é obrigatório (formato: YYYY-MM)' },
        { status: 400 }
      );
    }

    const [ano, mes] = mesAno.split('-').map(Number);
    if (!ano || !mes || mes < 1 || mes > 12) {
      return NextResponse.json(
        { error: 'Formato de mesAno inválido. Use YYYY-MM' },
        { status: 400 }
      );
    }

    // Conectar ao MySQL
    console.log('Tentando conectar ao MySQL:', {
      host: process.env.MYSQL_HOST || '200.98.112.240',
      user: process.env.MYSQL_USER || 'root',
      database: process.env.MYSQL_DATABASE || 'aspma',
      port: Number(process.env.MYSQL_PORT) || 3306,
    });

    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || '200.98.112.240',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'Aspma@2024',
      database: process.env.MYSQL_DATABASE || 'aspma',
      port: Number(process.env.MYSQL_PORT) || 3306,
      connectTimeout: 10000,
    });

    // Buscar parcelas do MySQL para o período
    let mysqlQuery = `
      SELECT 
        TRIM(p.matricula) as matricula,
        TRIM(p.associado) as associado,
        TRIM(p.codconven) as convenio_codigo,
        TRIM(p.conveniado) as convenio_nome,
        CAST(p.nrseq AS UNSIGNED) as num_parcela,
        p.parcelas as qtd_parcelas,
        p.valor, p.baixa as status,
        p.vencimento
      FROM parcelas p
      WHERE YEAR(p.vencimento) = ? AND MONTH(p.vencimento) = ?
    `;

    const params: any[] = [ano, mes];

    if (convenioId) {
      // Buscar código do convênio no PostgreSQL
      const convenio = await prisma.convenio.findUnique({
        where: { id: parseInt(convenioId) },
        select: { codigo: true },
      });

      if (convenio?.codigo) {
        mysqlQuery += ` AND TRIM(p.codconven) = ?`;
        params.push(convenio.codigo.trim());
      }
    }

    const [parcelas] = await connection.execute(mysqlQuery, params);
    const parcelasArray = parcelas as any[];

    console.log(`Encontradas ${parcelasArray.length} parcelas no MySQL`);

    // Agrupar por sócio, convênio e conjunto de parcelas
    // Usamos matrícula + código convênio + número da parcela 1 como identificador único
    const vendasMap = new Map<string, any>();

    parcelasArray.forEach((parcela) => {
      // Gerar chave única: matricula-convenio
      const key = `${parcela.matricula}-${parcela.convenio_codigo}`;
      
      if (!vendasMap.has(key)) {
        // Gerar número de venda único baseado em hash melhorado
        // Usando módulos menores para garantir que caiba em INT4 (max: 2,147,483,647)
        const matriculaHash = (parcela.matricula || '0').split('').reduce(
          (acc: number, char: string) => ((acc * 31) + char.charCodeAt(0)) % 20000, 0
        );
        const convenioHash = (parcela.convenio_codigo || '0').split('').reduce(
          (acc: number, char: string) => ((acc * 31) + char.charCodeAt(0)) % 100000, 0
        );
        // Resultado máximo: (19999 * 100000) + 99999 = 2,000,099,999 (dentro de INT4)
        const numeroVenda = (matriculaHash * 100000) + convenioHash;
        
        vendasMap.set(key, {
          matricula: (parcela.matricula || '').trim(),
          associado: (parcela.associado || '').trim(),
          numero_venda: numeroVenda,
          convenio_codigo: (parcela.convenio_codigo || '').trim(),
          convenio_nome: (parcela.convenio_nome || '').trim(),
          qtd_parcelas: parcela.qtd_parcelas,
          parcelas: [],
        });
      }
      vendasMap.get(key)!.parcelas.push(parcela);
    });

    console.log(`Identificadas ${vendasMap.size} vendas únicas`);

    // Buscar ou criar empresa ASPMA (todos os dados do MySQL pertencem a ela)
    let empresaAspma = await prisma.empresa.findFirst({
      where: {
        OR: [
          { nome: { contains: 'ASPMA', mode: 'insensitive' } },
          { nome: { contains: 'Associação dos Servidores Públicos', mode: 'insensitive' } },
        ],
      },
    });

    if (!empresaAspma) {
      empresaAspma = await prisma.empresa.create({
        data: {
          userId: userId,
          nome: 'ASPMA - Associação dos Servidores Públicos de Araucária',
          cnpj: null,
          ativo: true,
        },
      });
      console.log(`Empresa ASPMA criada: ID ${empresaAspma.id}`);
    } else {
      console.log(`Empresa ASPMA encontrada: ID ${empresaAspma.id}`);
    }

    // Processar cada venda
    for (const [key, vendaData] of vendasMap) {
      try {
        // Buscar ou criar sócio
        let socio = await prisma.socio.findFirst({
          where: { matricula: vendaData.matricula },
        });

        if (!socio) {
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
          console.log(`Sócio criado: ${socio.matricula} - Empresa: ${empresaAspma.id}`);
        } else if (!socio.empresaId) {
          socio = await prisma.socio.update({
            where: { id: socio.id },
            data: { empresaId: empresaAspma.id },
          });
          console.log(`Sócio atualizado: ${socio.matricula} - Empresa: ${empresaAspma.id}`);
        }

        // Buscar convênio pelo código
        let convenio = await prisma.convenio.findFirst({
          where: { codigo: vendaData.convenio_codigo },
        });

        if (!convenio) {
          // Criar convênio se não existir
          convenio = await prisma.convenio.create({
            data: {
              codigo: vendaData.convenio_codigo,
              razao_soc: vendaData.convenio_nome || 'Convênio não informado',
            },
          });
          console.log(`Convênio criado: ${convenio.codigo}`);
        }

        // Buscar venda existente
        let venda = await prisma.venda.findFirst({
          where: {
            socioId: socio.id,
            convenioId: convenio.id,
            numeroVenda: vendaData.numero_venda,
          },
        });

        if (!venda) {
          // Criar venda
          venda = await prisma.venda.create({
            data: {
              userId: userId,
              socioId: socio.id,
              convenioId: convenio.id,
              numeroVenda: vendaData.numero_venda,
              dataEmissao: new Date(),
              valorParcela: vendaData.parcelas.reduce(
                (sum: number, p: any) => sum + parseFloat(p.valor || '0'),
                0
              ) / vendaData.parcelas.length,
              valorTotal: vendaData.parcelas.reduce(
                (sum: number, p: any) => sum + parseFloat(p.valor || '0'),
                0
              ),
              quantidadeParcelas: parseInt(vendaData.qtd_parcelas) || vendaData.parcelas.length,
            },
          });
          result.vendasMigradas++;
          result.detalhes.vendasNovas++;
          console.log(`Venda criada: ${venda.numeroVenda}`);
        }

        // Processar parcelas
        for (const parcelaData of vendaData.parcelas) {
          const numeroParcela = parseInt(parcelaData.num_parcela) || 1;
          const valor = parseFloat(parcelaData.valor || '0');
          const dataVencimento = new Date(parcelaData.vencimento);
          const baixa = (parcelaData.status === 1 || parcelaData.status === '1') ? 'S' : null;

          // Verificar se parcela já existe
          let parcela = await prisma.parcela.findFirst({
            where: {
              vendaId: venda.id,
              numeroParcela,
            },
          });

          if (!parcela) {
            // Criar parcela
            await prisma.parcela.create({
              data: {
                vendaId: venda.id,
                numeroParcela,
                valor,
                dataVencimento,
                baixa,
                dataBaixa: baixa ? dataVencimento : null,
              },
            });
            result.parcelasMigradas++;
            result.detalhes.parcelasNovas++;
          } else {
            // Atualizar se necessário
            if (parcela.baixa !== baixa || parcela.valor.toNumber() !== valor) {
              await prisma.parcela.update({
                where: { id: parcela.id },
                data: {
                  baixa,
                  valor,
                  dataBaixa: baixa ? (parcela.dataBaixa || dataVencimento) : null,
                },
              });
              result.detalhes.parcelasAtualizadas++;
            }
          }
        }
      } catch (error) {
        const errorMsg = `Erro ao processar venda ${vendaData.numero_venda}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(errorMsg);
        result.erros.push(errorMsg);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Sincronização concluída em ${duration}s`);

    return NextResponse.json({
      success: true,
      message: 'Sincronização concluída',
      resultado: result,
      duracao: `${duration}s`,
      periodo: mesAno,
    });

  } catch (error) {
    console.error('Erro na sincronização:', error);
    
    // Detectar erro de acesso negado ao MySQL
    const isAccessDenied = error instanceof Error && 
      (error.message.includes('Access denied') || error.message.includes('ER_ACCESS_DENIED_ERROR'));
    
    let errorMessage = 'Erro ao sincronizar dados';
    let helpText = '';
    
    if (isAccessDenied) {
      errorMessage = 'Acesso negado ao MySQL remoto';
      helpText = 'O servidor MySQL (200.98.112.240) não permite conexões do Railway. ' +
                 'Solução: Execute no MySQL: GRANT ALL PRIVILEGES ON consignados.* TO \'root\'@\'%\' IDENTIFIED BY \'Aspma@2024\'; FLUSH PRIVILEGES; ' +
                 'Ou configure um usuário específico nas variáveis de ambiente do Railway. ' +
                 'Veja MYSQL_SYNC_CONFIG.md para mais detalhes.';
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Erro desconhecido',
        help: helpText || undefined,
        resultado: result,
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

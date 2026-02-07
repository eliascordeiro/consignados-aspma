import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestInfo } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';

// GET /api/vendas - Lista vendas com paginação
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!hasPermission(session.user, 'vendas.view')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const socioId = searchParams.get('socioId');
    const convenioId = searchParams.get('convenioId');
    const empresaId = searchParams.get('empresaId');
    const mesVencimento = searchParams.get('mesVencimento'); // formato: YYYY-MM
    const ativo = searchParams.get('ativo');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const cursor = searchParams.get('cursor'); // Para infinite scroll

    const whereClause: any = {};

    if (socioId) {
      whereClause.socioId = socioId;
    }

    if (convenioId) {
      whereClause.convenioId = parseInt(convenioId);
    }

    // Filtro por consignatária (empresa do sócio)
    // Será combinado com busca se necessário
    const socioFilter: any = {};
    if (empresaId) {
      socioFilter.empresaId = parseInt(empresaId);
    }

    // Filtro por mês/ano de vencimento das parcelas
    if (mesVencimento) {
      const [ano, mes] = mesVencimento.split('-').map(Number);
      const dataInicio = new Date(ano, mes - 1, 1);
      const dataFim = new Date(ano, mes, 0, 23, 59, 59);
      
      whereClause.parcelas = {
        some: {
          dataVencimento: {
            gte: dataInicio,
            lte: dataFim
          }
        }
      };
    }

    if (ativo !== null && ativo !== '') {
      whereClause.ativo = ativo === 'true';
    }

    // Busca por texto
    if (search) {
      const searchNumber = parseInt(search);
      whereClause.OR = [
        ...(isNaN(searchNumber) ? [] : [{ numeroVenda: searchNumber }]),
        { 
          socio: { 
            nome: { contains: search, mode: 'insensitive' },
            ...socioFilter // Combina filtro de empresa com busca
          } 
        },
        { 
          socio: { 
            matricula: { contains: search, mode: 'insensitive' },
            ...socioFilter
          } 
        },
        { convenio: { razao_soc: { contains: search, mode: 'insensitive' } } },
      ];
    } else if (Object.keys(socioFilter).length > 0) {
      // Se não tem busca mas tem filtro de empresa
      whereClause.socio = socioFilter;
    }

    console.log('[GET /api/vendas] Query params:', { 
      cursor, 
      page, 
      limit, 
      search, 
      ativo,
      socioId,
      convenioId,
      empresaId,
      mesVencimento,
      whereClause: JSON.stringify(whereClause) 
    });

    // Cursor-based pagination (melhor para infinite scroll)
    if (cursor) {
      const vendas = await prisma.venda.findMany({
        where: whereClause,
        take: limit + 1, // Pega um a mais para saber se tem próxima página
        cursor: {
          id: cursor,
        },
        skip: 1, // Pula o cursor
        include: {
          socio: {
            select: {
              id: true,
              nome: true,
              matricula: true,
            },
          },
          convenio: {
            select: {
              id: true,
              razao_soc: true,
              fantasia: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          parcelas: {
            select: {
              id: true,
              numeroParcela: true,
              baixa: true,
            },
            orderBy: {
              numeroParcela: 'asc',
            },
          },
        },
        orderBy: [
          { dataEmissao: 'desc' },
          { numeroVenda: 'desc' },
        ],
      });

      const hasMore = vendas.length > limit;
      const data = hasMore ? vendas.slice(0, -1) : vendas;
      const nextCursor = hasMore ? data[data.length - 1].id : null;

      console.log('[GET /api/vendas] Cursor pagination result:', {
        total: vendas.length,
        returned: data.length,
        hasMore,
        nextCursor,
        firstVenda: data[0]?.numeroVenda,
        lastVenda: data[data.length - 1]?.numeroVenda,
        sampleParcelas: data[0]?.parcelas?.length
      });

      return NextResponse.json({
        data,
        nextCursor,
        hasMore,
      });
    }

    // Offset-based pagination (tradicional)
    const skip = (page - 1) * limit;

    const [vendas, total, valorTotalGeral] = await Promise.all([
      prisma.venda.findMany({
        where: whereClause,
        take: limit,
        skip,
        include: {
          socio: {
            select: {
              id: true,
              nome: true,
              matricula: true,
            },
          },
          convenio: {
            select: {
              id: true,
              razao_soc: true,
              fantasia: true,
            },
          },
          parcelas: {
            select: {
              id: true,
              numeroParcela: true,
              baixa: true,
            },
            orderBy: {
              numeroParcela: 'asc',
            },
          },
        },
        orderBy: [
          { dataEmissao: 'desc' },
          { numeroVenda: 'desc' },
        ],
      }),
      prisma.venda.count({ where: whereClause }),
      prisma.venda.aggregate({
        where: whereClause,
        _sum: {
          valorTotal: true,
        },
      }),
    ]);

    console.log('[GET /api/vendas] Offset pagination result:', {
      page,
      limit,
      skip,
      total,
      returned: vendas.length,
      totalPages: Math.ceil(total / limit),
      valorTotalGeral: valorTotalGeral._sum.valorTotal,
      sampleParcelas: vendas[0]?.parcelas?.length
    });

    return NextResponse.json({
      data: vendas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        valorTotalGeral: valorTotalGeral._sum.valorTotal || 0,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar vendas' },
      { status: 500 }
    );
  }
}

// POST /api/vendas - Cria uma nova venda com parcelas
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!hasPermission(session.user, 'vendas.create')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const targetUserId = session.user.id;
    const body = await request.json();

    const {
      socioId,
      convenioId,
      numeroVenda,
      dataEmissao,
      operador,
      observacoes,
      parcelas,
    } = body;

    // Validações
    if (!socioId || !convenioId || !parcelas || parcelas.length === 0) {
      return NextResponse.json(
        { error: 'Dados obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Verifica se o sócio existe e pertence ao usuário
    const socio = await prisma.socio.findFirst({
      where: {
        id: socioId,
        userId: targetUserId,
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        matricula: true,
        cpf: true,
        tipo: true,
        numCompras: true,
      },
    });

    if (!socio) {
      return NextResponse.json(
        { error: 'Sócio não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Verifica se o convênio existe
    const convenio = await prisma.convenio.findFirst({
      where: {
        id: convenioId,
        ativo: true,
      },
    });

    if (!convenio) {
      return NextResponse.json(
        { error: 'Convênio não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Calcula valores
    const valorParcela = parseFloat(parcelas[0]?.valor || 0);
    const quantidadeParcelas = parcelas.length;
    const valorTotal = valorParcela * quantidadeParcelas;

    // Verifica se já existe uma venda com esse número para o sócio
    if (numeroVenda) {
      const vendaExistente = await prisma.venda.findFirst({
        where: {
          socioId,
          numeroVenda: parseInt(numeroVenda),
        },
      });

      if (vendaExistente) {
        return NextResponse.json(
          { error: 'Já existe uma venda com este número para este sócio' },
          { status: 400 }
        );
      }
    }

    // Obtém o próximo número de venda
    const ultimaVenda = await prisma.venda.findFirst({
      where: { socioId },
      orderBy: { numeroVenda: 'desc' },
    });

    const novoNumeroVenda = numeroVenda || (ultimaVenda?.numeroVenda || 0) + 1;

    // Regra AS200.PRG: Reserva margem no ZETRA ANTES de salvar no banco
    if (socio.tipo === '1') { // Apenas para consignatária
      console.log('🎯 [VENDA] Sócio tipo 1 (Consignatária) - Reservando margem no ZETRA...');
      
      const adeIdentificador = `M${socio.matricula}S${novoNumeroVenda}`;
      
      try {
        const zetraResponse = await fetch(`${request.url.split('/api')[0]}/api/vendas/reservar-zetra`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matricula: socio.matricula,
            cpf: socio.cpf,
            valorParcela: valorParcela,
            valorLiberado: valorParcela,
            prazo: quantidadeParcelas,
            adeIdentificador: adeIdentificador,
          }),
        });

        const zetraData = await zetraResponse.json();
        console.log('📥 [VENDA] Resposta ZETRA:', zetraData);

        if (!zetraData.sucesso) {
          console.log('❌ [VENDA] ZETRA recusou a reserva:', zetraData.mensagem);
          return NextResponse.json(
            { 
              error: 'ZETRA recusou a operação', 
              mensagem: zetraData.mensagem,
              detalhes: 'A margem não pôde ser reservada no ZETRA. Venda não foi criada.',
            },
            { status: 400 }
          );
        }

        console.log('✅ [VENDA] Margem reservada no ZETRA! Prosseguindo com salvamento no banco...');
      } catch (zetraError) {
        console.error('❌ [VENDA] Erro ao reservar margem no ZETRA:', zetraError);
        return NextResponse.json(
          { 
            error: 'Erro ao reservar margem no ZETRA',
            detalhes: zetraError instanceof Error ? zetraError.message : 'Erro desconhecido',
          },
          { status: 500 }
        );
      }
    }

    // Cria a venda com parcelas em uma transação
    const venda = await prisma.$transaction(async (tx) => {
      const novaVenda = await tx.venda.create({
        data: {
          userId: targetUserId,
          socioId,
          convenioId,
          numeroVenda: novoNumeroVenda,
          dataEmissao: dataEmissao ? new Date(dataEmissao) : new Date(),
          operador: operador || session.user.name,
          observacoes,
          quantidadeParcelas,
          valorParcela,
          valorTotal,
          createdById: session.user.id,
          updatedById: session.user.id,
        },
      });

      // Cria as parcelas
      const parcelasData = parcelas.map((parcela: any, index: number) => ({
        vendaId: novaVenda.id,
        numeroParcela: index + 1,
        dataVencimento: new Date(parcela.dataVencimento),
        valor: parseFloat(parcela.valor),
        baixa: parcela.baixa || null,
        dataBaixa: parcela.dataBaixa ? new Date(parcela.dataBaixa) : null,
        valorPago: parcela.valorPago ? parseFloat(parcela.valorPago) : null,
        tipo: parcela.tipo || null,
        observacoes: parcela.observacoes || null,
        createdById: session.user.id,
        updatedById: session.user.id,
      }));

      await tx.parcela.createMany({
        data: parcelasData,
      });

      // Atualiza o número de compras do sócio
      await tx.socio.update({
        where: { id: socioId },
        data: { numCompras: novoNumeroVenda },
      });

      return novaVenda;
    });

    // Registra no audit log
    const { ipAddress, userAgent } = getRequestInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name || '',
      userRole: session.user.role || 'USER',
      action: 'CREATE',
      module: 'vendas',
      entityId: venda.id,
      entityName: `Venda #${novoNumeroVenda} - ${socio.nome}`,
      description: `Criou venda #${novoNumeroVenda} para ${socio.nome} com ${quantidadeParcelas} parcelas`,
      metadata: {
        socioId,
        socioNome: socio.nome,
        convenioId,
        convenioNome: convenio.razao_soc,
        numeroVenda: novoNumeroVenda,
        quantidadeParcelas,
        valorTotal,
      },
      ipAddress,
      userAgent,
    });

    // Busca a venda criada com todos os relacionamentos
    const vendaCriada = await prisma.venda.findUnique({
      where: { id: venda.id },
      include: {
        socio: {
          select: {
            id: true,
            nome: true,
            matricula: true,
          },
        },
        convenio: {
          select: {
            id: true,
            razao_soc: true,
            fantasia: true,
          },
        },
        parcelas: {
          orderBy: {
            numeroParcela: 'asc',
          },
        },
      },
    });

    return NextResponse.json(vendaCriada, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar venda:', error);
    return NextResponse.json(
      { error: 'Erro ao criar venda', details: error.message },
      { status: 500 }
    );
  }
}

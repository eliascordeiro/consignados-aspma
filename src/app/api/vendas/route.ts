import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestInfo } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';

// GET /api/vendas - Lista todas as vendas
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!hasPermission(session.user, 'vendas.view')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const targetUserId = (session.user as any).createdById || session.user.id;

    const { searchParams } = new URL(request.url);
    const socioId = searchParams.get('socioId');
    const convenioId = searchParams.get('convenioId');
    const ativo = searchParams.get('ativo');

    const whereClause: any = {
      userId: targetUserId,
    };

    if (socioId) {
      whereClause.socioId = socioId;
    }

    if (convenioId) {
      whereClause.convenioId = parseInt(convenioId);
    }

    if (ativo !== null) {
      whereClause.ativo = ativo === 'true';
    }

    const vendas = await prisma.venda.findMany({
      where: whereClause,
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
          },
        },
        parcelas: {
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

    return NextResponse.json(vendas);
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

    const targetUserId = (session.user as any).createdById || session.user.id;
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

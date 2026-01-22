import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';

type RouteParams = Promise<{
  id: string;
}>;

// GET /api/parcelas/[id] - Busca uma parcela específica
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!hasPermission(session.user, 'vendas.view')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const targetUserId = (session.user as any).createdById || session.user.id;

    const parcela = await prisma.parcela.findFirst({
      where: {
        id: params.id,
        venda: {
          userId: targetUserId,
        },
      },
      include: {
        venda: {
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
          },
        },
      },
    });

    if (!parcela) {
      return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 });
    }

    return NextResponse.json(parcela);
  } catch (error) {
    console.error('Erro ao buscar parcela:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar parcela' },
      { status: 500 }
    );
  }
}

// PUT /api/parcelas/[id] - Atualiza uma parcela (principalmente para baixa)
export async function PUT(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!hasPermission(session.user, 'vendas.edit')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const targetUserId = (session.user as any).createdById || session.user.id;

    // Verifica se a parcela existe e pertence ao usuário
    const parcelaExistente = await prisma.parcela.findFirst({
      where: {
        id: params.id,
        venda: {
          userId: targetUserId,
        },
      },
      include: {
        venda: {
          include: {
            socio: true,
          },
        },
      },
    });

    if (!parcelaExistente) {
      return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { baixa, dataBaixa, valorPago, dataVencimento, valor, observacoes } = body;

    const changes: any = {};

    if (baixa !== undefined && baixa !== parcelaExistente.baixa) {
      changes.baixa = baixa;
      
      // Se está dando baixa, registra a data e valor
      if (baixa && !parcelaExistente.baixa) {
        changes.dataBaixa = dataBaixa ? new Date(dataBaixa) : new Date();
        changes.valorPago = valorPago ? parseFloat(valorPago) : parseFloat(parcelaExistente.valor.toString());
      }
      
      // Se está removendo a baixa, limpa os campos
      if (!baixa && parcelaExistente.baixa) {
        changes.dataBaixa = null;
        changes.valorPago = null;
      }
    }

    if (dataBaixa !== undefined && dataBaixa !== parcelaExistente.dataBaixa) {
      changes.dataBaixa = dataBaixa ? new Date(dataBaixa) : null;
    }

    if (valorPago !== undefined && parseFloat(valorPago || 0) !== parseFloat(parcelaExistente.valorPago?.toString() || '0')) {
      changes.valorPago = valorPago ? parseFloat(valorPago) : null;
    }

    if (dataVencimento !== undefined && new Date(dataVencimento).getTime() !== parcelaExistente.dataVencimento.getTime()) {
      changes.dataVencimento = new Date(dataVencimento);
    }

    if (valor !== undefined && parseFloat(valor) !== parseFloat(parcelaExistente.valor.toString())) {
      changes.valor = parseFloat(valor);
    }

    if (observacoes !== undefined && observacoes !== parcelaExistente.observacoes) {
      changes.observacoes = observacoes;
    }

    const parcelaAtualizada = await prisma.parcela.update({
      where: { id: params.id },
      data: changes,
      include: {
        venda: {
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
          },
        },
      },
    });

    // Registra no audit log
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name || '',
      userRole: session.user.role || 'USER',
      action: 'UPDATE',
      module: 'vendas',
      entityId: params.id,
      entityName: `Parcela ${parcelaExistente.numeroParcela}/${parcelaExistente.venda.quantidadeParcelas} - Venda #${parcelaExistente.venda.numeroVenda}`,
      description: `Atualizou parcela ${parcelaExistente.numeroParcela} da venda #${parcelaExistente.venda.numeroVenda} de ${parcelaExistente.venda.socio.nome}`,
      metadata: {
        vendaId: parcelaExistente.vendaId,
        numeroVenda: parcelaExistente.venda.numeroVenda,
        numeroParcela: parcelaExistente.numeroParcela,
        changes,
      },
      request,
    });

    return NextResponse.json(parcelaAtualizada);
  } catch (error: any) {
    console.error('Erro ao atualizar parcela:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar parcela', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/parcelas/[id] - Exclui uma parcela
export async function DELETE(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!hasPermission(session.user, 'vendas.delete')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const targetUserId = (session.user as any).createdById || session.user.id;

    // Verifica se a parcela existe e pertence ao usuário
    const parcela = await prisma.parcela.findFirst({
      where: {
        id: params.id,
        venda: {
          userId: targetUserId,
        },
      },
      include: {
        venda: {
          include: {
            socio: true,
            parcelas: true,
          },
        },
      },
    });

    if (!parcela) {
      return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 });
    }

    // Não permite excluir se for a única parcela
    if (parcela.venda.parcelas.length === 1) {
      return NextResponse.json(
        { error: 'Não é possível excluir a única parcela da venda' },
        { status: 400 }
      );
    }

    // Exclui a parcela e recalcula a venda
    await prisma.$transaction(async (tx) => {
      await tx.parcela.delete({
        where: { id: params.id },
      });

      // Recalcula valores da venda
      const parcelasRestantes = await tx.parcela.findMany({
        where: { vendaId: parcela.vendaId },
      });

      const novaQuantidade = parcelasRestantes.length;
      const novoValorTotal = parcelasRestantes.reduce(
        (sum, p) => sum + parseFloat(p.valor.toString()),
        0
      );

      await tx.venda.update({
        where: { id: parcela.vendaId },
        data: {
          quantidadeParcelas: novaQuantidade,
          valorTotal: novoValorTotal,
        },
      });
    });

    // Registra no audit log
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name || '',
      userRole: session.user.role || 'USER',
      action: 'DELETE',
      module: 'vendas',
      entityId: params.id,
      entityName: `Parcela ${parcela.numeroParcela}/${parcela.venda.quantidadeParcelas} - Venda #${parcela.venda.numeroVenda}`,
      description: `Excluiu parcela ${parcela.numeroParcela} da venda #${parcela.venda.numeroVenda} de ${parcela.venda.socio.nome}`,
      metadata: {
        vendaId: parcela.vendaId,
        numeroVenda: parcela.venda.numeroVenda,
        numeroParcela: parcela.numeroParcela,
        valor: parseFloat(parcela.valor.toString()),
      },
      request,
    });

    return NextResponse.json({ message: 'Parcela excluída com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir parcela:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir parcela', details: error.message },
      { status: 500 }
    );
  }
}

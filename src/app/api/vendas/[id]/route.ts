import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestInfo } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';
import { getDataUserId } from '@/lib/get-data-user-id';

type RouteParams = Promise<{
  id: string;
}>;

// GET /api/vendas/[id] - Busca uma venda específica
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

    const targetUserId = await getDataUserId(session as any);

    // Buscar convênios vinculados ao usuário (para vendas lançadas pelo portal de convênios)
    const conveniosDoUsuario = await prisma.convenio.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    });
    const convenioIdsDoUsuario = conveniosDoUsuario.map((c) => c.id);

    const vendaWhere =
      convenioIdsDoUsuario.length > 0
        ? {
            id: params.id,
            OR: [
              { userId: targetUserId },
              { convenioId: { in: convenioIdsDoUsuario } },
            ],
          }
        : { id: params.id, userId: targetUserId };

    const venda = await prisma.venda.findFirst({
      where: vendaWhere,
      include: {
        socio: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            cpf: true,
            celular: true,
          },
        },
        convenio: {
          select: {
            id: true,
            razao_soc: true,
            codigo: true,
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
          orderBy: {
            numeroParcela: 'asc',
          },
        },
      },
    });

    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
    }

    return NextResponse.json(venda);
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar venda' },
      { status: 500 }
    );
  }
}

// PUT /api/vendas/[id] - Atualiza uma venda
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

    const targetUserId = await getDataUserId(session as any);

    // Verifica se a venda existe e pertence ao usuário
    const vendaExistente = await prisma.venda.findFirst({
      where: {
        id: params.id,
        userId: targetUserId,
      },
      include: {
        socio: true,
        convenio: true,
        parcelas: true,
      },
    });

    if (!vendaExistente) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { operador, observacoes, parcelas } = body;

    const changes: any = {};
    
    if (operador !== undefined && operador !== vendaExistente.operador) {
      changes.operador = operador;
    }
    
    if (observacoes !== undefined && observacoes !== vendaExistente.observacoes) {
      changes.observacoes = observacoes;
    }

    // Sempre atualiza o updatedById
    changes.updatedById = session.user.id;

    // Atualiza a venda e parcelas em uma transação
    const vendaAtualizada = await prisma.$transaction(async (tx) => {
      // Atualiza a venda
      const venda = await tx.venda.update({
        where: { id: params.id },
        data: changes,
      });

      // Se houver parcelas para atualizar
      if (parcelas && Array.isArray(parcelas)) {
        for (const parcela of parcelas) {
          if (parcela.id) {
            await tx.parcela.update({
              where: { id: parcela.id },
              data: {
                dataVencimento: parcela.dataVencimento
                  ? new Date(parcela.dataVencimento)
                  : undefined,
                valor: parcela.valor ? parseFloat(parcela.valor) : undefined,
                baixa: parcela.baixa !== undefined ? parcela.baixa : undefined,
                dataBaixa: parcela.dataBaixa
                  ? new Date(parcela.dataBaixa)
                  : parcela.baixa === null
                  ? null
                  : undefined,
                valorPago: parcela.valorPago
                  ? parseFloat(parcela.valorPago)
                  : parcela.baixa === null
                  ? null
                  : undefined,
                tipo: parcela.tipo !== undefined ? parcela.tipo : undefined,
                observacoes:
                  parcela.observacoes !== undefined
                    ? parcela.observacoes
                    : undefined,
                updatedById: session.user.id,
              },
            });
          }
        }

        // Recalcula o valor total se as parcelas mudaram
        const parcelasAtualizadas = await tx.parcela.findMany({
          where: { vendaId: params.id },
        });

        const valorTotal = parcelasAtualizadas.reduce(
          (sum, p) => sum + parseFloat(p.valor.toString()),
          0
        );

        await tx.venda.update({
          where: { id: params.id },
          data: { valorTotal, updatedById: session.user.id },
        });
      }

      return venda;
    });

    // Registra no audit log
    const { ipAddress: ipAddrUpdate, userAgent: userAgentUpdate } = getRequestInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name || '',
      userRole: session.user.role || 'USER',
      action: 'UPDATE',
      module: 'vendas',
      entityId: params.id,
      entityName: `Venda #${vendaExistente.numeroVenda} - ${vendaExistente.socio.nome}`,
      description: `Atualizou venda #${vendaExistente.numeroVenda} de ${vendaExistente.socio.nome}`,
      metadata: {
        changes,
        parcelas: parcelas?.length || 0,
      },
      ipAddress: ipAddrUpdate,
      userAgent: userAgentUpdate,
    });

    // Busca a venda atualizada com todos os relacionamentos
    const vendaCompleta = await prisma.venda.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(vendaCompleta);
  } catch (error: any) {
    console.error('Erro ao atualizar venda:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar venda', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/vendas/[id] - Exclui uma venda (soft delete ou hard delete)
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

    const targetUserId = await getDataUserId(session as any);

    // Verifica se a venda existe e pertence ao usuário
    const venda = await prisma.venda.findFirst({
      where: {
        id: params.id,
        userId: targetUserId,
      },
      include: {
        socio: true,
        parcelas: true,
      },
    });

    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    // AS200.PRG: Se venda é ZETRA (tipo != 3 e != 4), deve liquidar na ZETRA ANTES de deletar
    // Conforme linha 932 do AS200.PRG - sempre chama excluir_venda() primeiro
    const tipoSocio = venda.socio.tipo?.toString() || '';
    const isZetra = tipoSocio !== '3' && tipoSocio !== '4';

    if (isZetra) {
      console.log(`🔥 [VENDA DELETE] Venda tipo ${tipoSocio} - Liquidando na ZETRA antes de deletar...`);
      
      try {
        // Monta identificador conforme AS200.PRG: "M" + matricula + "S" + sequencia
        const adeIdentificador = `M${venda.socio.matricula}S${venda.numeroVenda}`;
        
        const zetraResponse = await fetch(`${request.url.split('/api')[0]}/api/vendas/liquidar-zetra`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adeIdentificador,
            motivoCancelamento: 'Venda excluída',
          }),
        });

        const zetraData = await zetraResponse.json();
        console.log('📥 [VENDA DELETE] Resposta ZETRA liquidação:', zetraData);

        if (!zetraData.sucesso) {
          console.log('⚠️  [VENDA DELETE] ZETRA recusou a liquidação:', zetraData.mensagem);
          return NextResponse.json(
            {
              error: 'ZETRA recusou a liquidação', 
              mensagem: zetraData.mensagem,
              detalhes: 'A margem não pôde ser liberada na ZETRA. Venda não foi excluída.',
            },
            { status: 400 }
          );
        }

        console.log('✅ [VENDA DELETE] Margem liquidada na ZETRA! Prosseguindo com exclusão no banco...');
      } catch (zetraError) {
        console.error('❌ [VENDA DELETE] Erro ao liquidar margem na ZETRA:', zetraError);
        return NextResponse.json(
          {
            error: 'Erro ao liquidar margem na ZETRA',
            detalhes: zetraError instanceof Error ? zetraError.message : 'Erro desconhecido',
            aviso: 'Venda não foi excluída para evitar inconsistência com ZETRA',
          },
          { status: 500 }
        );
      }
    } else {
      console.log(`ℹ️  [VENDA DELETE] Venda tipo ${tipoSocio} (local) - Não requer liquidação ZETRA`);
    }

    if (hardDelete) {
      // Hard delete - remove completamente (as parcelas serão removidas em cascata)
      await prisma.venda.delete({
        where: { id: params.id },
      });
    } else {
      // Soft delete - apenas marca como inativo/cancelado
      await prisma.venda.update({
        where: { id: params.id },
        data: {
          ativo: false,
          cancelado: true,
          motivoCancelamento: 'Venda excluída',
        },
      });
    }

    // Registra no audit log
    const { ipAddress: ipAddrDelete, userAgent: userAgentDelete } = getRequestInfo(request);
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name || '',
      userRole: session.user.role || 'USER',
      action: 'DELETE',
      module: 'vendas',
      entityId: params.id,
      entityName: `Venda #${venda.numeroVenda} - ${venda.socio.nome}`,
      description: `${hardDelete ? 'Excluiu permanentemente' : 'Cancelou'} venda #${venda.numeroVenda} de ${venda.socio.nome}`,
      metadata: {
        numeroVenda: venda.numeroVenda,
        socioNome: venda.socio.nome,
        quantidadeParcelas: venda.quantidadeParcelas,
        valorTotal: parseFloat(venda.valorTotal.toString()),
        hardDelete,
      },
      ipAddress: ipAddrDelete,
      userAgent: userAgentDelete,
    });

    return NextResponse.json({ message: 'Venda excluída com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir venda:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir venda', details: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { alterarConsignacao, formatCpf } from '@/lib/zetra-soap';

/**
 * POST /api/zetra/alterar-consignacao
 * Altera dados de consignação
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricula, cpf, numeroContrato, novaDataVencimento, novoValorParcela } = body;

    if (!matricula || !cpf || !numeroContrato) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: matricula, cpf, numeroContrato' },
        { status: 400 }
      );
    }

    if (!novaDataVencimento && !novoValorParcela) {
      return NextResponse.json(
        { error: 'Informe ao menos novaDataVencimento ou novoValorParcela' },
        { status: 400 }
      );
    }

    const cpfFormatado = formatCpf(cpf);

    const result = await alterarConsignacao({
      matricula,
      cpf: cpfFormatado,
      numeroContrato: String(numeroContrato),
      novaDataVencimento,
      novoValorParcela: novoValorParcela ? String(novoValorParcela) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      matricula,
      cpf: cpfFormatado,
      numeroContrato,
      detalhes: result.data,
    });
  } catch (error: any) {
    console.error('[ZETRA API] Erro ao alterar consignação:', error);
    return NextResponse.json(
      { error: 'Erro ao alterar consignação', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/zetra/alterar-consignacao',
    method: 'POST',
    description: 'Altera dados de consignação existente',
    body: {
      matricula: 'string (obrigatório)',
      cpf: 'string (obrigatório)',
      numeroContrato: 'string (obrigatório)',
      novaDataVencimento: 'string (opcional, formato: DD/MM/YYYY)',
      novoValorParcela: 'number (opcional)',
    },
  });
}

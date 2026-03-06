import { NextRequest, NextResponse } from 'next/server';
import { excluirReserva, formatCpf } from '@/lib/zetra-soap';

/**
 * POST /api/zetra/excluir-reserva
 * Exclui reserva de margem
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricula, cpf, numeroReserva } = body;

    if (!matricula || !cpf || !numeroReserva) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: matricula, cpf, numeroReserva' },
        { status: 400 }
      );
    }

    const cpfFormatado = formatCpf(cpf);

    const result = await excluirReserva({
      matricula,
      cpf: cpfFormatado,
      numeroReserva: String(numeroReserva),
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
      numeroReserva,
      detalhes: result.data,
    });
  } catch (error: any) {
    console.error('[ZETRA API] Erro ao excluir reserva:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir reserva', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/zetra/excluir-reserva',
    method: 'POST',
    description: 'Exclui reserva de margem consignável',
    body: {
      matricula: 'string (obrigatório)',
      cpf: 'string (obrigatório)',
      numeroReserva: 'string (obrigatório)',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { reservarMargem, formatCpf } from '@/lib/zetra-soap';

/**
 * POST /api/zetra/reservar-margem
 * Reserva margem consignável
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      matricula,
      cpf,
      valorParcela,
      valorLiberado,
      prazo,
      codVerba,
      servicoCodigo,
      adeIdentificador,
    } = body;

    if (!matricula || !cpf || !valorParcela || !prazo || !adeIdentificador) {
      return NextResponse.json(
        {
          error: 'Campos obrigatórios: matricula, cpf, valorParcela, prazo, adeIdentificador',
        },
        { status: 400 }
      );
    }

    const cpfFormatado = formatCpf(cpf);

    const result = await reservarMargem({
      matricula,
      cpf: cpfFormatado,
      valorParcela: String(valorParcela),
      valorLiberado: String(valorLiberado || valorParcela),
      prazo: Number(prazo),
      codVerba,
      servicoCodigo,
      adeIdentificador,
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
      numeroReserva: result.data?.numeroReserva,
      matricula,
      cpf: cpfFormatado,
      detalhes: result.data,
    });
  } catch (error: any) {
    console.error('[ZETRA API] Erro ao reservar margem:', error);
    return NextResponse.json(
      { error: 'Erro ao reservar margem', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/zetra/reservar-margem',
    method: 'POST',
    description: 'Reserva margem consignável',
    body: {
      matricula: 'string (obrigatório)',
      cpf: 'string (obrigatório)',
      valorParcela: 'number (obrigatório)',
      valorLiberado: 'number (opcional)',
      prazo: 'number (obrigatório)',
      codVerba: 'string (opcional, padrão: 441)',
      servicoCodigo: 'string (opcional, padrão: 018)',
      adeIdentificador: 'string (obrigatório)',
    },
  });
}

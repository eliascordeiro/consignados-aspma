import { NextRequest, NextResponse } from 'next/server';
import { consultarMargem, formatCpf } from '@/lib/zetra-soap';

/**
 * POST /api/zetra/consultar-margem
 * Consulta margem disponível de um servidor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricula, cpf, valorParcela = '100.00' } = body;

    if (!matricula || !cpf) {
      return NextResponse.json(
        { error: 'Matrícula e CPF são obrigatórios' },
        { status: 400 }
      );
    }

    // Formatar CPF se necessário
    const cpfFormatado = formatCpf(cpf);

    const result = await consultarMargem({
      matricula,
      cpf: cpfFormatado,
      valorParcela,
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

    const valorMargem = result.data?.valorMargem || result.data?.margem || '0';

    return NextResponse.json({
      success: true,
      margem: parseFloat(valorMargem),
      matricula,
      cpf: cpfFormatado,
      detalhes: result.data,
    });
  } catch (error: any) {
    console.error('[ZETRA API] Erro ao consultar margem:', error);
    return NextResponse.json(
      { error: 'Erro ao consultar margem', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/zetra/consultar-margem',
    method: 'POST',
    description: 'Consulta margem consignável disponível',
    body: {
      matricula: 'string (obrigatório)',
      cpf: 'string (obrigatório)',
      valorParcela: 'string (opcional, padrão: 100.00)',
    },
    example: {
      matricula: '822901',
      cpf: '830.508.929-00',
      valorParcela: '100.00',
    },
  });
}

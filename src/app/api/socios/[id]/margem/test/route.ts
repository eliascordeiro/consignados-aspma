import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ZETRA_CONFIG = {
  phpUrl: 'http://200.98.112.240/aspma/php/zetra_desktop/consultaMargemZetra.php',
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  
  try {
    const socioId = resolvedParams.id;

    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true,
        matricula: true,
        nome: true,
        tipo: true,
        cpf: true,
        margemConsig: true,
      },
    });

    if (!socio) {
      return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 });
    }

    // Monta a URL completa que seria chamada
    const queryParams = new URLSearchParams({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      matricula: socio.matricula || '',
      cpf: socio.cpf || '',
      valorParcela: '0.1',
    });

    const urlCompleta = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`;

    // Faz a chamada real
    let zetraResponse = null;
    let zetraError = null;
    let zetraRawXml = null;

    try {
      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: queryParams.toString(),
      });

      zetraRawXml = await response.text();
      zetraResponse = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      };
    } catch (error) {
      zetraError = error instanceof Error ? error.message : 'Erro desconhecido';
    }

    // Retorna todas as informações para debug
    return NextResponse.json({
      socio: {
        id: socio.id,
        nome: socio.nome,
        matricula: socio.matricula,
        cpf: socio.cpf,
        tipo: socio.tipo,
        margemConsig: socio.margemConsig,
      },
      zetra: {
        url_completa: urlCompleta,
        parametros: {
          cliente: ZETRA_CONFIG.cliente,
          convenio: ZETRA_CONFIG.convenio,
          usuario: ZETRA_CONFIG.usuario,
          senha: '***' + ZETRA_CONFIG.senha.slice(-4),
          matricula: socio.matricula,
          cpf: socio.cpf,
          valorParcela: '0.1',
        },
        response: zetraResponse,
        raw_xml: zetraRawXml,
        error: zetraError,
      },
      instrucoes: {
        teste_navegador: 'Copie a URL abaixo e cole no navegador para testar diretamente:',
        url_para_testar: urlCompleta,
        teste_curl: `curl -X POST "${urlCompleta}" -H "Content-Type: application/x-www-form-urlencoded" -d "${queryParams.toString()}"`,
      }
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao gerar teste', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

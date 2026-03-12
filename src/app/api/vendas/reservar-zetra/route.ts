import { NextRequest, NextResponse } from 'next/server';

// URL base do serviço PHP Zetra (Railway ou servidor externo)
const ZETRA_BASE_URL = process.env.ZETRA_BASE_URL || 'http://200.98.112.240/aspma/php/zetra_desktop';

const ZETRA_CONFIG = {
  phpUrl: `${ZETRA_BASE_URL}/reservarMargemZetra.php`,
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
};

// Função auxiliar para extrair XML entre tags
function extractXmlValue(startTag: string, endTag: string, xml: string): string | null {
  const startIndex = xml.indexOf(startTag);
  if (startIndex === -1) return null;

  const valueStart = startIndex + startTag.length;
  const endIndex = xml.indexOf(endTag, valueStart);
  if (endIndex === -1) return null;

  return xml.substring(valueStart, endIndex).trim();
}

export async function POST(request: NextRequest) {
  console.log('\n🚀 [ZETRA RESERVA] Iniciando reserva de margem...');
  
  try {
    const body = await request.json();
    const {
      matricula,
      cpf,
      valorParcela,
      valorLiberado,
      prazo,
      adeIdentificador, // Ex: "M222101S123"
    } = body;

    console.log('📋 [ZETRA RESERVA] Parâmetros:', {
      matricula,
      cpf,
      valorParcela,
      valorLiberado,
      prazo,
      adeIdentificador,
    });

    // Validações
    if (!matricula || !cpf || !valorParcela || !prazo || !adeIdentificador) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Monta parâmetros conforme AS200.PRG
    const queryParams = new URLSearchParams({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      matricula: matricula,
      cpf: cpf,
      valorParcela: valorParcela.toString(),
      valorLiberado: (valorLiberado || valorParcela).toString(),
      prazo: prazo.toString(),
      codVerba: '441', // Fixo conforme AS200.PRG
      servicoCodigo: '018', // Fixo conforme AS200.PRG
      adeIdentificador: adeIdentificador,
    });

    const urlWithParams = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`;
    console.log('📤 [ZETRA RESERVA] Fazendo POST...');

    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: queryParams.toString(),
    });

    if (!response.ok) {
      console.log('❌ [ZETRA RESERVA] Erro HTTP:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Erro ao comunicar com ZETRA', status: response.status },
        { status: 500 }
      );
    }

    const xmlResponse = await response.text();
    console.log('📥 [ZETRA RESERVA] Resposta recebida (primeiros 500 chars):', xmlResponse.substring(0, 500));

    // Extrai resultado do XML
    const sucesso = extractXmlValue('<ns10:sucesso>', '</ns10:sucesso>', xmlResponse);
    const mensagem = extractXmlValue('<ns10:mensagem>', '</ns10:mensagem>', xmlResponse);
    const codRetorno = extractXmlValue('<ns10:codRetorno>', '</ns10:codRetorno>', xmlResponse);

    console.log('📊 [ZETRA RESERVA] Resultado:', { sucesso, mensagem, codRetorno });

    if (sucesso === 'false' || mensagem?.includes('FALHA') || mensagem?.includes('Erro')) {
      console.log('⚠️  [ZETRA RESERVA] Operação recusada pelo ZETRA');
      return NextResponse.json({
        sucesso: false,
        mensagem: mensagem || 'Erro desconhecido',
        codRetorno,
        xmlCompleto: xmlResponse,
      }, { status: 400 });
    }

    console.log('✅ [ZETRA RESERVA] Margem reservada com sucesso!');
    return NextResponse.json({
      sucesso: true,
      mensagem: mensagem || 'Operação realizada com sucesso.',
      codRetorno,
      xmlCompleto: xmlResponse,
    });

  } catch (error) {
    console.error('❌ [ZETRA RESERVA] Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro ao reservar margem', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

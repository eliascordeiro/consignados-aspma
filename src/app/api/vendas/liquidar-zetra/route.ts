import { NextRequest, NextResponse } from 'next/server';

// URL base do serviço PHP Zetra (Railway ou servidor externo)
const ZETRA_BASE_URL = process.env.ZETRA_BASE_URL || 'http://200.98.112.240/aspma/php/zetra_desktop';

const ZETRA_CONFIG = {
  phpUrl: `${ZETRA_BASE_URL}/reservarExluirZetra.php`,
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

/**
 * POST /api/vendas/liquidar-zetra
 * 
 * Liquida (cancela) uma consignação na ZETRA, liberando a margem do sócio.
 * Conforme AS200.PRG linha 1781 - função excluir_venda()
 * 
 * Chama o webservice ZETRA liquidarConsignacao via reservarExluirZetra.php
 */
export async function POST(request: NextRequest) {
  console.log('\n🔥 [ZETRA LIQUIDAR] Iniciando liquidação de venda...');
  
  try {
    const body = await request.json();
    const {
      adeIdentificador, // Ex: "M222101S123" - formato matricula+sequencia
      motivoCancelamento = 'aspma',
    } = body;

    console.log('📋 [ZETRA LIQUIDAR] Parâmetros:', {
      adeIdentificador,
      motivoCancelamento,
    });

    // Validações
    if (!adeIdentificador) {
      return NextResponse.json(
        { error: 'adeIdentificador é obrigatório' },
        { status: 400 }
      );
    }

    // Monta parâmetros conforme AS200.PRG linha 1799-1806
    const queryParams = new URLSearchParams({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      adeIdentificador: adeIdentificador,
      codigoMotivoOperacao: '99', // Código fixo conforme AS200.PRG
      obsMotivoOperacao: motivoCancelamento,
    });

    const urlWithParams = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`;
    console.log('📤 [ZETRA LIQUIDAR] Fazendo POST para liquidar venda...');

    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: queryParams.toString(),
    });

    if (!response.ok) {
      console.log('❌ [ZETRA LIQUIDAR] Erro HTTP:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Erro ao comunicar com ZETRA', status: response.status },
        { status: 500 }
      );
    }

    const xmlResponse = await response.text();
    console.log('📥 [ZETRA LIQUIDAR] Resposta recebida (primeiros 500 chars):', xmlResponse.substring(0, 500));

    if (!xmlResponse || xmlResponse.trim() === '') {
      console.log('⚠️  [ZETRA LIQUIDAR] Resposta vazia do servidor ZETRA');
      return NextResponse.json(
        { error: 'Servidor ZETRA não respondeu' },
        { status: 502 }
      );
    }

    // Extrai resultado do XML (conforme AS200.PRG linha 1841)
    const mensagem = extractXmlValue('<ns10:mensagem>', '</ns10:mensagem>', xmlResponse);
    const sucesso = extractXmlValue('<ns10:sucesso>', '</ns10:sucesso>', xmlResponse);
    const codRetorno = extractXmlValue('<ns10:codRetorno>', '</ns10:codRetorno>', xmlResponse);

    console.log('📊 [ZETRA LIQUIDAR] Resultado:', { sucesso, mensagem, codRetorno });

    // Verifica se houve erro
    if (sucesso === 'false' || mensagem?.includes('FALHA') || mensagem?.includes('Erro')) {
      console.log('⚠️  [ZETRA LIQUIDAR] Operação recusada pelo ZETRA');
      return NextResponse.json({
        sucesso: false,
        mensagem: mensagem || 'Erro desconhecido ao liquidar venda',
        codRetorno,
        xmlCompleto: xmlResponse,
      });
    }

    console.log('✅ [ZETRA LIQUIDAR] Venda liquidada com sucesso na ZETRA!');
    
    return NextResponse.json({
      sucesso: true,
      mensagem: mensagem || 'Operação realizada com sucesso.',
      codRetorno,
      adeIdentificador,
    });

  } catch (error) {
    console.error('❌ [ZETRA LIQUIDAR] Erro ao processar requisição:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao liquidar venda na ZETRA',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

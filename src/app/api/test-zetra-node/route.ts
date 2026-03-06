import { NextRequest, NextResponse } from 'next/server';
import * as soap from 'soap';

const ZETRA_WSDL = 'https://api.econsig.com.br/central/services/HostaHostService?wsdl';

const ZETRA_CREDENTIALS = {
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
};

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 [TEST ZETRA NODE] Iniciando teste SOAP...');

    const body = await request.json();
    const { matricula, cpf, valorParcela = '100.00' } = body;

    console.log('📋 [TEST ZETRA NODE] Parâmetros:', { matricula, cpf, valorParcela });

    // Criar cliente SOAP
    console.log('🌐 [TEST ZETRA NODE] Criando cliente SOAP:', ZETRA_WSDL);
    const client = await soap.createClientAsync(ZETRA_WSDL);

    console.log('📤 [TEST ZETRA NODE] Chamando consultarMargem...');

    // Fazer chamada SOAP
    const args = {
      cliente: ZETRA_CREDENTIALS.cliente,
      convenio: ZETRA_CREDENTIALS.convenio,
      usuario: ZETRA_CREDENTIALS.usuario,
      senha: ZETRA_CREDENTIALS.senha,
      matricula,
      cpf,
      valorParcela,
    };

    const [result, rawResponse, soapHeader, rawRequest] = await client.consultarMargemAsync(args);

    console.log('📥 [TEST ZETRA NODE] Resposta recebida:', JSON.stringify(result, null, 2));

    // Extrair dados da resposta
    const response = result?.consultarMargemResponse || result;

    const sucesso = response?.sucesso === 'true' || response?.sucesso === true;
    const codRetorno = response?.codRetorno;
    const mensagem = response?.mensagem;
    const valorMargem = response?.valorMargem;

    if (!sucesso) {
      console.log(`❌ [TEST ZETRA NODE] Erro ${codRetorno}: ${mensagem}`);
      return NextResponse.json({
        success: false,
        error: {
          code: codRetorno,
          message: mensagem,
        },
        source: 'node-soap',
        rawRequest: rawRequest,
        rawResponse: rawResponse,
      }, { status: 400 });
    }

    console.log(`✅ [TEST ZETRA NODE] Margem: R$ ${valorMargem}`);

    return NextResponse.json({
      success: true,
      margem: parseFloat(valorMargem || '0'),
      source: 'node-soap',
      details: {
        matricula,
        cpf,
        valorParcela,
      },
      rawResponse: response,
    });

  } catch (error: any) {
    console.error('❌ [TEST ZETRA NODE] Erro:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
      },
      source: 'node-soap',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de teste SOAP Node.js - use POST',
    example: {
      method: 'POST',
      body: {
        matricula: '822901',
        cpf: '830.508.929-00',
        valorParcela: '100.00',
      },
    },
  });
}

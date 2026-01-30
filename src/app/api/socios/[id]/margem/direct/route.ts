import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Credenciais ZETRA
const ZETRA_CONFIG = {
  wsdlUrl: 'https://api.econsig.com.br/central/services/HostaHostService?wsdl',
  soapEndpoint: 'https://api.econsig.com.br/central/services/HostaHostService',
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
};

// Função para criar envelope SOAP manualmente
function criarSoapEnvelope(params: {
  cliente: string;
  convenio: string;
  usuario: string;
  senha: string;
  matricula: string;
  cpf: string;
  valorParcela: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <consultarMargem xmlns="http://host.ws.econsig.com.br/">
      <cliente>${params.cliente}</cliente>
      <convenio>${params.convenio}</convenio>
      <usuario>${params.usuario}</usuario>
      <senha>${params.senha}</senha>
      <matricula>${params.matricula}</matricula>
      <cpf>${params.cpf}</cpf>
      <valorParcela>${params.valorParcela}</valorParcela>
    </consultarMargem>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Função auxiliar para extrair valor do XML
function extractXmlValue(xml: string, tagName: string): string | null {
  // Tenta com namespace
  const regexWithNs = new RegExp(`<[^:]+:${tagName}[^>]*>([^<]*)<\/[^:]+:${tagName}>`, 'i');
  const matchWithNs = xml.match(regexWithNs);
  if (matchWithNs) return matchWithNs[1].trim();
  
  // Tenta sem namespace
  const regexNoNs = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
  const matchNoNs = xml.match(regexNoNs);
  if (matchNoNs) return matchNoNs[1].trim();
  
  return null;
}

// Função para consultar margem diretamente na API ZETRA via SOAP
async function consultarMargemZetraDirect(params: {
  matricula: string;
  cpf: string;
  valorParcela: string;
}): Promise<{ margem: number | null; erro?: string; xml?: string }> {
  console.log('🚀 [ZETRA DIRECT] Iniciando consulta DIRETA via SOAP...');
  console.log('📋 [ZETRA DIRECT] Parâmetros:', params);
  
  try {
    const soapEnvelope = criarSoapEnvelope({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      matricula: params.matricula,
      cpf: params.cpf,
      valorParcela: params.valorParcela,
    });

    console.log('📤 [ZETRA DIRECT] Enviando SOAP Request...');
    console.log('🌐 [ZETRA DIRECT] Endpoint:', ZETRA_CONFIG.soapEndpoint);
    console.log('📝 [ZETRA DIRECT] SOAP Envelope completo:');
    console.log(soapEnvelope);
    console.log('📋 [ZETRA DIRECT] Headers:', {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'consultarMargem',
    });
    
    const response = await fetch(ZETRA_CONFIG.soapEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'consultarMargem',
      },
      body: soapEnvelope,
    });

    console.log('📥 [ZETRA DIRECT] Status da resposta:', response.status, response.statusText);
    console.log('📥 [ZETRA DIRECT] Headers da resposta:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('❌ [ZETRA DIRECT] Erro HTTP:', response.status, response.statusText);
      console.log('📄 [ZETRA DIRECT] Corpo do erro (primeiros 2000 chars):');
      console.log(errorBody.substring(0, 2000));
      return { 
        margem: null, 
        erro: `Erro HTTP ${response.status}: ${response.statusText}`,
        xml: errorBody
      };
    }

    const xmlResponse = await response.text();
    console.log('📥 [ZETRA DIRECT] Resposta recebida com sucesso');
    console.log('📏 [ZETRA DIRECT] Tamanho da resposta:', xmlResponse.length, 'caracteres');
    console.log('📄 [ZETRA DIRECT] XML completo (primeiros 2000 chars):');
    console.log(xmlResponse.substring(0, 2000));

    if (!xmlResponse || xmlResponse.trim() === '') {
      console.log('⚠️  [ZETRA DIRECT] Resposta vazia');
      return { margem: null, erro: 'Resposta vazia da API' };
    }

    // Verifica se houve erro
    const sucesso = extractXmlValue(xmlResponse, 'sucesso');
    console.log('🔍 [ZETRA DIRECT] Sucesso extraído:', sucesso);
    
    if (sucesso === 'false') {
      const codRetorno = extractXmlValue(xmlResponse, 'codRetorno');
      const mensagem = extractXmlValue(xmlResponse, 'mensagem');
      console.log('❌ [ZETRA DIRECT] Erro na consulta:', { sucesso, codRetorno, mensagem });
      return { 
        margem: null, 
        erro: `${codRetorno}: ${mensagem}`,
        xml: xmlResponse 
      };
    }

    // Extrai a margem
    const margemStr = extractXmlValue(xmlResponse, 'valorMargem');
    console.log('🔍 [ZETRA DIRECT] Margem extraída (string):', margemStr);
    
    if (!margemStr) {
      console.log('⚠️  [ZETRA DIRECT] Margem não encontrada no XML');
      console.log('📄 [ZETRA DIRECT] Buscando tags disponíveis...');
      const tags = xmlResponse.match(/<[^/][^>]+>/g)?.slice(0, 20);
      console.log('🏷️  [ZETRA DIRECT] Primeiras 20 tags:', tags);
      return { margem: null, erro: 'Margem não encontrada na resposta', xml: xmlResponse };
    }

    const margem = parseFloat(margemStr.replace(',', '.'));
    
    if (isNaN(margem)) {
      console.log('⚠️  [ZETRA DIRECT] Margem inválida:', margemStr);
      return { margem: null, erro: `Margem inválida: ${margemStr}`, xml: xmlResponse };
    }

    console.log('✅ [ZETRA DIRECT] Margem extraída com sucesso:', margem);
    return { margem, xml: xmlResponse };

  } catch (error: any) {
    console.error('💥 [ZETRA DIRECT] Erro na requisição SOAP:', error);
    console.error('💥 [ZETRA DIRECT] Stack trace:', error.stack);
    return { 
      margem: null, 
      erro: error.message || 'Erro desconhecido' 
    };
  }
}

// GET /api/socios/[id]/margem/direct - Consulta margem diretamente na API ZETRA
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  console.log('\n🔷 [API DIRECT] GET /api/socios/[id]/margem/direct');
  console.log('📌 [API DIRECT] ID do sócio:', id);

  try {
    // Busca o sócio no banco
    const socio = await prisma.socio.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        matricula: true,
        cpf: true,
        margemConsig: true,
      },
    });

    if (!socio) {
      console.log('❌ [API DIRECT] Sócio não encontrado');
      return NextResponse.json(
        { error: 'Sócio não encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ [API DIRECT] Sócio encontrado:', {
      id: socio.id,
      nome: socio.nome,
      matricula: socio.matricula,
      cpf: socio.cpf,
    });

    // Valida dados necessários para ZETRA
    if (!socio.matricula || !socio.cpf) {
      console.log('⚠️  [API DIRECT] Dados insuficientes para consulta ZETRA');
      return NextResponse.json({
        margem: parseFloat(socio.margemConsig?.toString() || '0'),
        fonte: 'banco',
        erro: 'Matrícula ou CPF ausente',
      });
    }

    // Remove formatação do CPF
    const cpfLimpo = socio.cpf.replace(/\D/g, '');

    // Consulta diretamente na API ZETRA
    const resultado = await consultarMargemZetraDirect({
      matricula: socio.matricula,
      cpf: cpfLimpo,
      valorParcela: '0.01', // Valor mínimo para consulta
    });

    if (resultado.margem !== null) {
      console.log('✅ [API DIRECT] Margem consultada com sucesso via ZETRA');
      return NextResponse.json({
        margem: resultado.margem,
        fonte: 'zetra_direct',
        socio: {
          id: socio.id,
          nome: socio.nome,
          matricula: socio.matricula,
          cpf: socio.cpf,
        },
        xml: resultado.xml?.substring(0, 500), // Primeiros 500 chars do XML
      });
    } else {
      console.log('⚠️  [API DIRECT] Falha na consulta ZETRA, usando banco de dados');
      return NextResponse.json({
        margem: parseFloat(socio.margemConsig?.toString() || '0'),
        fonte: 'banco_fallback',
        erro: resultado.erro,
        socio: {
          id: socio.id,
          nome: socio.nome,
          matricula: socio.matricula,
          cpf: socio.cpf,
        },
      });
    }

  } catch (error: any) {
    console.error('💥 [API DIRECT] Erro:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao consultar margem',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

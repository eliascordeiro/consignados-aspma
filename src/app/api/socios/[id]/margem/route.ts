import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Credenciais ZETRA (considere mover para variáveis de ambiente)
const ZETRA_CONFIG = {
  phpUrl: 'http://200.98.112.240/aspma/php/zetra_desktop/consultaMargemZetra.php',
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
};

interface MargemZetraParams {
  cliente: string;
  convenio: string;
  usuario: string;
  senha: string;
  matricula: string;
  cpf: string;
  valorParcela: string;
}

// Função auxiliar para extrair XML entre tags (equivalente a lcx())
function extractXmlValue(startTag: string, endTag: string, xml: string): string | null {
  const startIndex = xml.indexOf(startTag);
  if (startIndex === -1) return null;
  
  const valueStart = startIndex + startTag.length;
  const endIndex = xml.indexOf(endTag, valueStart);
  if (endIndex === -1) return null;
  
  return xml.substring(valueStart, endIndex).trim();
}

// Função auxiliar para chamar o PHP ZETRA
async function consultarMargemZetra(params: MargemZetraParams): Promise<number | null | { margem: number; mensagem?: string; codRetorno?: string }> {
  console.log('🔵 [ZETRA] Iniciando consulta de margem via PHP...');
  console.log('📋 [ZETRA] Parâmetros:', {
    matricula: params.matricula,
    cpf: params.cpf,
    valorParcela: params.valorParcela,
  });
  
  try {
    console.log('🌐 [ZETRA] URL:', ZETRA_CONFIG.phpUrl);
    
    // Monta a query string
    const queryParams = new URLSearchParams({
      cliente: params.cliente,
      convenio: params.convenio,
      usuario: params.usuario,
      senha: params.senha,
      matricula: params.matricula,
      cpf: params.cpf,
      valorParcela: params.valorParcela,
    });

    const urlWithParams = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`;
    console.log('📤 [ZETRA] Fazendo POST...');

    // Faz a requisição POST
    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: queryParams.toString(),
    });

    if (!response.ok) {
      console.log('❌ [ZETRA] Erro HTTP:', response.status, response.statusText);
      return null;
    }

    const xmlResponse = await response.text();
    console.log('📥 [ZETRA] Resposta recebida (primeiros 500 chars):', xmlResponse.substring(0, 500));

    if (!xmlResponse || xmlResponse.trim() === '') {
      console.log('⚠️  [ZETRA] Resposta vazia');
      return null;
    }

    // Verifica se houve erro na resposta
    const sucesso = extractXmlValue('<ns13:sucesso>', '</ns13:sucesso>', xmlResponse);
    const codRetorno = extractXmlValue('<ns13:codRetorno>', '</ns13:codRetorno>', xmlResponse);
    const mensagem = extractXmlValue('<ns13:mensagem>', '</ns13:mensagem>', xmlResponse);
    
    if (sucesso === 'false') {
      console.log('❌ [ZETRA] Erro na consulta:', {
        sucesso,
        codRetorno,
        mensagem,
      });
      console.log(`⚠️  [ZETRA] ZETRA retornou erro ${codRetorno}: ${mensagem}`);
      // Retorna objeto com mensagem de erro (não null) - regra AS200.PRG
      return { margem: 0, mensagem, codRetorno };
    }

    // Extrai a margem do XML (equivalente ao lcx do PRG)
    const margemStr = extractXmlValue(
      '<ns6:valorMargem xmlns:ns6="InfoMargem">',
      '</ns6:valorMargem>',
      xmlResponse
    );

    console.log('🔍 [ZETRA] Margem extraída:', margemStr);

    if (!margemStr) {
      console.log('⚠️  [ZETRA] Tag valorMargem não encontrada no XML');
      return null;
    }

    const margem = parseFloat(margemStr);
    console.log('✅ [ZETRA] Margem convertida:', margem);

    return isNaN(margem) ? null : margem;

  } catch (error) {
    console.error('❌ [ZETRA] Erro na consulta:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('\n🚀 [API] /api/socios/[id]/margem - Requisição recebida');
  
  // Await params (Next.js 16+ requirement)
  
  // Extrai valorParcela da query string (regra AS200.PRG)
  const { searchParams } = new URL(request.url);
  const valorParcelaParam = searchParams.get('valorParcela');
  const valorParcela = valorParcelaParam ? valorParcelaParam : '0.1';
  console.log('💰 [API] Valor da parcela para consulta:', valorParcela);
  const resolvedParams = await params;
  console.log('📝 [API] Parâmetros:', resolvedParams);
  
  try {
    const socioId = resolvedParams.id; // ID é string no Prisma
    console.log('🔢 [API] ID do sócio:', socioId);

    console.log('🔍 [API] Buscando sócio no banco de dados...');
    // Busca o sócio no banco de dados
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true,
        matricula: true,
        nome: true,
        tipo: true,
        margemConsig: true,
        cpf: true,
      },
    });

    if (!socio) {
      console.log('❌ [API] Sócio não encontrado');
      return NextResponse.json(
        { error: 'Sócio não encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ [API] Sócio encontrado:', {
      id: socio.id,
      matricula: socio.matricula,
      nome: socio.nome,
      tipo: socio.tipo,
      margemConsig: socio.margemConsig,
    });

    // Se não for consignatária (tipo != 1), retorna o valor do banco
    if (socio.tipo !== '1') {
      console.log('📦 [API] Tipo != 1, retornando margem do banco de dados');
      return NextResponse.json({
        matricula: socio.matricula,
        nome: socio.nome,
        margem: Number(socio.margemConsig || 0),
        tipo: 'banco_dados',
        fonte: 'local',
      });
    }

    console.log('🎯 [API] Tipo = 1 (Consignatária), consultando ZETRA...');
    
    // Para consignatária (tipo = 1), consulta ZETRA via PHP
    const matriculaAtual = socio.matricula || '';
    const cpf = socio.cpf || '';

    console.log('📋 [API] Dados para consulta ZETRA:', {
      matriculaAtual,
      cpf,
    });

    if (!cpf || !matriculaAtual) {
      console.log('⚠️  [API] CPF ou matrícula não encontrado');
      return NextResponse.json(
        { error: 'CPF e matrícula são obrigatórios para consulta ZETRA' },
        { status: 400 }
      );
    }

    // Faz a consultvalorParcela, // Usa valor da query ou 0.1 padrão
    const margemZetra = await consultarMargemZetra({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      matricula: matriculaAtual,
      cpf: cpf,
      valorParcela: valorParcela, // Usa valor da query ou 0.1 padrão
    });

    if (margemZetra === null) {
      console.log('⚠️  [API] ZETRA retornou null, usando fallback do banco');
      // Fallback para o valor do banco se ZETRA falhar
      return NextResponse.json({
        matricula: socio.matricula,
        nome: socio.nome,
        margem: Number(socio.margemConsig || 0),
        tipo: 'banco_dados',
        fonte: 'fallback',
        aviso: 'ZETRA indisponível, usando valor do banco de dados',
      });
    }

    // Se retornou objeto com erro (margem <= 0)
    if (typeof margemZetra === 'object' && 'mensagem' in margemZetra) {
      console.log('⚠️  [API] ZETRA retornou erro:', margemZetra);
      return NextResponse.json({
        matricula: socio.matricula,
        nome: socio.nome,
        margem: 0,
        tipo: 'zetra_erro',
        fonte: 'tempo_real',
        mensagem: margemZetra.mensagem,
        codRetorno: margemZetra.codRetorno,
      });
    }
    }

    console.log('✅ [API] Consulta ZETRA concluída com sucesso! Margem:', margemZetra);
    // Retorna o valor consultado do ZETRA
    return NextResponse.json({
      matricula: socio.matricula,
      nome: socio.nome,
      margem: margemZetra || 0,
      tipo: 'zetra',
      fonte: 'tempo_real',
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar margem:', error);
    console.error('❌ [API] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      { error: 'Erro ao buscar margem do sócio' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as soap from 'soap';

// Credenciais ZETRA (considere mover para variáveis de ambiente)
const ZETRA_CONFIG = {
  wsdl: 'https://www.econsig.com.br/central/services/HostaHostService?wsdl',
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

// Função auxiliar para chamar o webservice ZETRA diretamente
async function consultarMargemZetra(params: MargemZetraParams): Promise<number | null> {
  console.log('🔵 [ZETRA] Iniciando consulta de margem...');
  console.log('📋 [ZETRA] Parâmetros:', {
    matricula: params.matricula,
    cpf: params.cpf,
    valorParcela: params.valorParcela,
  });
  
  try {
    console.log('🌐 [ZETRA] Criando cliente SOAP:', ZETRA_CONFIG.wsdl);
    
    // Cria o client SOAP
    const client = await soap.createClientAsync(ZETRA_CONFIG.wsdl, {
      disableCache: true,
      wsdl_options: {
        timeout: 20000,
      },
    });

    console.log('✅ [ZETRA] Cliente SOAP criado com sucesso');
    console.log('📤 [ZETRA] Enviando requisição consultarMargem...');

    // Faz a chamada ao método consultarMargem
    const [result] = await client.consultarMargemAsync({
      cliente: params.cliente,
      convenio: params.convenio,
      usuario: params.usuario,
      senha: params.senha,
      matricula: params.matricula,
      cpf: params.cpf,
      valorParcela: params.valorParcela,
    });

    console.log('📥 [ZETRA] Resposta recebida:', JSON.stringify(result, null, 2));

    // Extrai o valor da margem da resposta
    // A estrutura exata pode variar, ajuste conforme necessário
    const valorMargem = result?.valorMargem || result?.return?.valorMargem;

    if (valorMargem) {
      console.log('✅ [ZETRA] Margem extraída com sucesso:', valorMargem);
      return parseFloat(valorMargem);
    }

    console.log('⚠️  [ZETRA] Nenhum valor de margem encontrado na resposta');
    return null;
  } catch (error) {
    console.error('❌ [ZETRA] Erro ao consultar margem:', error);
    console.error('❌ [ZETRA] Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('\n🚀 [API] /api/socios/[id]/margem - Requisição recebida');
  
  // Await params (Next.js 16+ requirement)
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
        matriculas: {
          select: {
            matricula_atual: true,
          },
        },
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
        margem: socio.margemConsig || 0,
        tipo: 'banco_dados',
        fonte: 'local',
      });
    }

    console.log('🎯 [API] Tipo = 1 (Consignatária), consultando ZETRA...');
    
    // Para consignatária (tipo = 1), consulta ZETRA
    const matriculaAtual = socio.matriculas?.matricula_atual || socio.matricula;
    const cpf = socio.cpf || '';

    console.log('📋 [API] Dados para consulta ZETRA:', {
      matriculaAtual,
      cpf,
      temMatriculaAtual: !!socio.matriculas?.matricula_atual,
    });

    if (!cpf) {
      console.log('⚠️  [API] CPF não encontrado');
      return NextResponse.json(
        { error: 'CPF não cadastrado para este sócio' },
        { status: 400 }
      );
    }

    // Faz a consulta ZETRA
    const margemZetra = await consultarMargemZetra({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      matricula: matriculaAtual,
      cpf: cpf,
      valorParcela: '1.00',
    });

    if (margemZetra === null) {
      console.log('⚠️  [API] ZETRA retornou null, usando fallback do banco');
      // Fallback para o valor do banco se ZETRA falhar
      return NextResponse.json({
        matricula: socio.matricula,
        nome: socio.nome,
        margem: socio.margemConsig || 0,
        tipo: 'banco_dados',
        fonte: 'fallback',
        aviso: 'ZETRA indisponível, usando valor do banco de dados',
      });
    }

    console.log('✅ [API] Consulta ZETRA concluída com sucesso! Margem:', margemZetra);
    // Retorna o valor consultado do ZETRA
    return NextResponse.json({
      matricula: socio.matricula,
      nome: socio.nome,
      margem: margemZetra,
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

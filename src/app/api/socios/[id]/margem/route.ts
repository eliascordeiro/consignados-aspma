import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { calcularDataCorte } from '@/lib/data-corte';
import { getDataUserId } from '@/lib/get-data-user-id';
import { hasPermission } from '@/lib/permissions';

import { formatCpf } from '@/lib/zetra-soap';

// URL base do serviço PHP Zetra (Railway interno ou servidor externo)
const ZETRA_BASE_URL = process.env.ZETRA_BASE_URL || 'http://200.98.112.240/aspma/php/zetra_desktop';

const ZETRA_CONFIG = {
  phpUrl: `${ZETRA_BASE_URL}/consultaMargemZetra.php`,
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
};

function extractXmlValue(startTag: string, endTag: string, xml: string): string | null {
  const startIndex = xml.indexOf(startTag);
  if (startIndex === -1) return null;
  const valueStart = startIndex + startTag.length;
  const endIndex = xml.indexOf(endTag, valueStart);
  if (endIndex === -1) return null;
  return xml.substring(valueStart, endIndex).trim();
}

async function consultarMargemZetra(params: {
  matricula: string;
  cpf: string;
  valorParcela: string;
}): Promise<{ sucesso: boolean; margem?: number; mensagem?: string; codRetorno?: string }> {
  const queryParams = new URLSearchParams({
    cliente: ZETRA_CONFIG.cliente,
    convenio: ZETRA_CONFIG.convenio,
    usuario: ZETRA_CONFIG.usuario,
    senha: ZETRA_CONFIG.senha,
    matricula: params.matricula,
    cpf: params.cpf,
    valorParcela: params.valorParcela,
  });

  const urlWithParams = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`;
  const response = await fetch(urlWithParams, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: queryParams.toString(),
  });

  if (!response.ok) {
    return { sucesso: false, mensagem: `HTTP ${response.status}` };
  }

  const xmlResponse = await response.text();
  if (!xmlResponse || xmlResponse.trim() === '') {
    return { sucesso: false, mensagem: 'Resposta vazia' };
  }

  const sucesso = extractXmlValue('<ns13:sucesso>', '</ns13:sucesso>', xmlResponse);
  const codRetorno = extractXmlValue('<ns13:codRetorno>', '</ns13:codRetorno>', xmlResponse);
  const mensagem = extractXmlValue('<ns13:mensagem>', '</ns13:mensagem>', xmlResponse);

  if (sucesso === 'false') {
    return { sucesso: false, mensagem: mensagem || undefined, codRetorno: codRetorno || undefined };
  }

  const margemStr = extractXmlValue(
    '<ns6:valorMargem xmlns:ns6="InfoMargem">',
    '</ns6:valorMargem>',
    xmlResponse
  );

  if (!margemStr) return { sucesso: false, mensagem: 'Margem não encontrada na resposta' };
  const margem = parseFloat(margemStr);
  return isNaN(margem) ? { sucesso: false, mensagem: 'Valor de margem inválido' } : { sucesso: true, margem };
}

// Função para calcular data de corte (Regra AS200.PRG)
// Se dia > 09: próximo mês, senão: mês atual
// Função para calcular descontos do mês (parcelas não pagas)
// Regra AS200.PRG: SELECT sum(valor) FROM parcelas WHERE month(vencimento) = lMes AND year(vencimento) = lAno AND baixa = '' AND matricula = X
async function calcularDescontosDoMes(socioId: string, matricula: string, dataCorte: { mes: number; ano: number }): Promise<number> {
  try {
    console.log(`📊 [CÁLCULO] Calculando descontos para matrícula ${matricula} em ${dataCorte.mes}/${dataCorte.ano}`);
    
    // Primeiro, vamos contar quantas parcelas existem no total para debug
    const totalParcelas = await prisma.parcela.count({
      where: {
        venda: {
          socioId: socioId,
        },
      },
    });
    console.log(`📋 [CÁLCULO] Total de parcelas do sócio: ${totalParcelas}`);
    
    // Contar parcelas do mês de corte (pagas e não pagas)
    const parcelasDoMes = await prisma.parcela.count({
      where: {
        venda: {
          socioId: socioId,
        },
        dataVencimento: {
          gte: new Date(dataCorte.ano, dataCorte.mes - 1, 1),
          lt: new Date(dataCorte.ano, dataCorte.mes, 1),
        },
      },
    });
    console.log(`📋 [CÁLCULO] Total de parcelas do mês ${dataCorte.mes}/${dataCorte.ano}: ${parcelasDoMes}`);
    
    // Prisma estrutura: Parcela -> Venda -> Socio
    // Busca parcelas não pagas (baixa vazio, null ou 'N') de vendas ATIVAS (não canceladas)
    const result = await prisma.parcela.aggregate({
      _sum: {
        valor: true,
      },
      where: {
        venda: {
          socioId: socioId,
          ativo: true,        // NOVO: só conta parcelas de vendas ativas
          cancelado: false,   // NOVO: exclui vendas canceladas
        },
        OR: [
          { baixa: '' },
          { baixa: null },
          { baixa: 'N' },    // Migração MySQL->PG: 'N' = não baixada
        ],
        dataVencimento: {
          gte: new Date(dataCorte.ano, dataCorte.mes - 1, 1), // Primeiro dia do mês
          lt: new Date(dataCorte.ano, dataCorte.mes, 1), // Primeiro dia do próximo mês
        },
      },
    });

    const totalDescontos = Number(result._sum.valor || 0);
    console.log(`✅ [CÁLCULO] Total de descontos do mês (não pagas): R$ ${totalDescontos.toFixed(2)}`);
    
    return totalDescontos;
  } catch (error) {
    console.error('❌ [CÁLCULO] Erro ao calcular descontos:', error);
    return 0;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('\n🚀 [API] /api/socios/[id]/margem - Requisição recebida');
  
  // Verificar autenticação
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Permitir acesso se:
  // 1. Tem margem.view (acesso ao módulo margem consignada)
  // 2. Tem vendas.* (precisa consultar margem para criar/editar vendas)
  const hasMargemAccess = hasPermission(session.user, 'margem.view');
  const hasVendasAccess = 
    hasPermission(session.user, 'vendas.view') ||
    hasPermission(session.user, 'vendas.create') ||
    hasPermission(session.user, 'vendas.edit');
  
  if (!hasMargemAccess && !hasVendasAccess) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  // Buscar userId correto (herda dados do MANAGER se for subordinado)
  const dataUserId = await getDataUserId(session as any);

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
    // Busca o sócio no banco de dados (filtrado pelo userId correto)
    const socio = await prisma.socio.findFirst({
      where: { id: socioId, userId: dataUserId },
      select: {
        id: true,
        matricula: true,
        nome: true,
        tipo: true,
        margemConsig: true,
        cpf: true,
        limite: true, // NOVO: campo limite para tipos 3 e 4
        empresa: { select: { diaCorte: true } },
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
      limite: socio.limite,
    });

    // REGRA AS200.PRG: TIPO 3 ou 4 = Cálculo local (limite - descontos)
    if (socio.tipo === '3' || socio.tipo === '4') {
      console.log('🧮 [API] Tipo 3 ou 4, calculando margem local (limite - descontos)');
      
      const dataCorte = calcularDataCorte(socio.empresa?.diaCorte ?? 9); // diaCorte da consignatária (empresa) do sócio
      console.log(`📅 [API] Data de corte: ${dataCorte.mes}/${dataCorte.ano}`);
      
      const descontos = await calcularDescontosDoMes(socio.id, socio.matricula || '', dataCorte);
      const limite = Number(socio.limite || 0);
      const margem = limite - descontos;
      
      console.log(`💰 [API] Cálculo: ${limite} (limite) - ${descontos} (descontos) = ${margem} (margem)`);
      
      return NextResponse.json({
        matricula: socio.matricula,
        nome: socio.nome,
        margem: margem,
        limite: limite,
        descontos: descontos,
        mesReferencia: `${dataCorte.mes}/${dataCorte.ano}`,
        tipo: 'calculo_local',
        fonte: 'local',
      });
    }

    // REGRA AS200.PRG: Tipos != 3 e != 4 (prefeitura) = Consulta ZETRA
    console.log('🎯 [API] Tipo != 3 e != 4 (Prefeitura/Consignatária), consultando ZETRA...');
    
    // Para consignatária (tipo = 1), consulta ZETRA via PHP
    const matriculaAtual = socio.matricula || '';
    const cpfOriginal = socio.cpf || '';
    const cpfFormatado = formatCpf(cpfOriginal);

    console.log('📋 [API] Dados para consulta ZETRA:', {
      matriculaAtual,
      cpf: cpfFormatado,
    });

    if (!cpfFormatado || !matriculaAtual) {
      console.log('⚠️  [API] CPF ou matrícula não encontrado');
      return NextResponse.json(
        { error: 'CPF e matrícula são obrigatórios para consulta ZETRA' },
        { status: 400 }
      );
    }

    // Faz a consulta ZETRA diretamente via PHP (sem self-fetch)
    try {
      const zetraResult = await consultarMargemZetra({
        matricula: matriculaAtual,
        cpf: cpfFormatado,
        valorParcela: valorParcela,
      });

      if (!zetraResult.sucesso) {
        console.log('⚠️  [API] ZETRA retornou erro:', zetraResult.mensagem);
        return NextResponse.json({
          matricula: socio.matricula,
          nome: socio.nome,
          margem: 0,
          tipo: 'zetra_erro',
          fonte: 'tempo_real',
          mensagem: zetraResult.mensagem || 'Erro desconhecido',
          codRetorno: zetraResult.codRetorno,
        });
      }

      const margemZetra = zetraResult.margem || 0;
      console.log('✅ [API] Consulta ZETRA concluída com sucesso! Margem:', margemZetra);
      
      return NextResponse.json({
        matricula: socio.matricula,
        nome: socio.nome,
        margem: margemZetra,
        tipo: 'zetra',
        fonte: 'tempo_real',
      });

    } catch (zetraError) {
      console.log('⚠️  [API] Erro ao chamar ZETRA, usando fallback do banco:', zetraError);
      return NextResponse.json({
        matricula: socio.matricula,
        nome: socio.nome,
        margem: Number(socio.margemConsig || 0),
        tipo: 'banco_dados',
        fonte: 'fallback',
        aviso: 'ZETRA indisponível, usando valor do banco de dados',
      });
    }

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar margem:', error);
    console.error('❌ [API] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      { error: 'Erro ao buscar margem do sócio' },
      { status: 500 }
    );
  }
}

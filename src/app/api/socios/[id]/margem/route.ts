import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { calcularDataCorte } from '@/lib/data-corte';
import { getDataUserId } from '@/lib/get-data-user-id';
import { hasPermission } from '@/lib/permissions';

import { formatCpf } from '@/lib/zetra-soap';

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
    // Busca parcelas não pagas (baixa vazio ou null) de vendas ATIVAS (não canceladas)
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

    // Faz a consulta ZETRA via endpoint Node.js interno
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const zetraResponse = await fetch(`${baseUrl}/api/zetra/consultar-margem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricula: matriculaAtual,
          cpf: cpfFormatado,
          valorParcela: valorParcela,
        }),
      });

      const zetraResult = await zetraResponse.json();

      if (!zetraResult.success) {
        console.log('⚠️  [API] ZETRA retornou erro:', zetraResult.error);
        return NextResponse.json({
          matricula: socio.matricula,
          nome: socio.nome,
          margem: 0,
          tipo: 'zetra_erro',
          fonte: 'tempo_real',
          mensagem: zetraResult.error?.message || 'Erro desconhecido',
          codRetorno: zetraResult.error?.code,
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

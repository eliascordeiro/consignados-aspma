import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'
import { createAuditLog, getRequestInfo } from '@/lib/audit-log'

// Credenciais ZETRA
const ZETRA_CONFIG = {
  phpUrl: 'http://200.98.112.240/aspma/php/zetra_desktop/consultaMargemZetra.php',
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
}

function extractXmlValue(startTag: string, endTag: string, xml: string): string | null {
  const startIndex = xml.indexOf(startTag)
  if (startIndex === -1) return null
  const valueStart = startIndex + startTag.length
  const endIndex = xml.indexOf(endTag, valueStart)
  if (endIndex === -1) return null
  return xml.substring(valueStart, endIndex).trim()
}

async function consultarMargemZetra(params: {
  matricula: string
  cpf: string
  valorParcela: string
}): Promise<number | null | { margem: number; mensagem?: string; codRetorno?: string }> {
  try {
    const queryParams = new URLSearchParams({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      matricula: params.matricula,
      cpf: params.cpf,
      valorParcela: params.valorParcela,
    })

    const urlWithParams = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`
    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: queryParams.toString(),
    })

    if (!response.ok) return null

    const xmlResponse = await response.text()
    if (!xmlResponse || xmlResponse.trim() === '') return null

    const sucesso = extractXmlValue('<ns13:sucesso>', '</ns13:sucesso>', xmlResponse)
    const codRetorno = extractXmlValue('<ns13:codRetorno>', '</ns13:codRetorno>', xmlResponse)
    const mensagem = extractXmlValue('<ns13:mensagem>', '</ns13:mensagem>', xmlResponse)

    if (sucesso === 'false') {
      return { margem: 0, mensagem: mensagem || undefined, codRetorno: codRetorno || undefined }
    }

    const margemStr = extractXmlValue(
      '<ns6:valorMargem xmlns:ns6="InfoMargem">',
      '</ns6:valorMargem>',
      xmlResponse
    )

    if (!margemStr) return null
    const margem = parseFloat(margemStr)
    return isNaN(margem) ? null : margem
  } catch (error) {
    console.error('[ZETRA CONVENIADO] Erro:', error)
    return null
  }
}

// Data de corte: dia > 9 = próximo mês, senão mês atual
function calcularDataCorte(): { mes: number; ano: number } {
  const hoje = new Date()
  const dia = hoje.getDate()
  let mes = hoje.getMonth() + 1
  let ano = hoje.getFullYear()

  if (dia > 9) {
    if (mes === 12) {
      mes = 1
      ano = ano + 1
    } else {
      mes = mes + 1
    }
  }

  return { mes, ano }
}

// Descontos do mês: soma de parcelas não pagas de vendas ativas
async function calcularDescontosDoMes(
  socioId: string,
  dataCorte: { mes: number; ano: number }
): Promise<number> {
  try {
    const result = await prisma.parcela.aggregate({
      _sum: { valor: true },
      where: {
        venda: {
          socioId,
          ativo: true,
          cancelado: false,
        },
        OR: [{ baixa: '' }, { baixa: null }],
        dataVencimento: {
          gte: new Date(dataCorte.ano, dataCorte.mes - 1, 1),
          lt: new Date(dataCorte.ano, dataCorte.mes, 1),
        },
      },
    })

    return Number(result._sum.valor || 0)
  } catch (error) {
    console.error('[CONVENIADO] Erro ao calcular descontos:', error)
    return 0
  }
}

// GET /api/convenio/socios/margem?socioId=xxx&valorParcela=100
export async function GET(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)
    const requestInfo = getRequestInfo(request)

    const { searchParams } = new URL(request.url)
    const socioId = searchParams.get('socioId')
    const valorParcelaParam = searchParams.get('valorParcela') || '0.1'

    if (!socioId) {
      return NextResponse.json({ error: 'socioId é obrigatório' }, { status: 400 })
    }

    const socio = await prisma.socio.findFirst({
      where: { id: socioId, ativo: true },
      select: {
        id: true,
        nome: true,
        matricula: true,
        cpf: true,
        tipo: true,
        limite: true,
        margemConsig: true,
      },
    })

    if (!socio) {
      return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })
    }

    // REGRA AS200.PRG: TIPO 3 ou 4 = Cálculo local (limite - descontos)
    if (socio.tipo === '3' || socio.tipo === '4') {
      const dataCorte = calcularDataCorte()
      const descontos = await calcularDescontosDoMes(socio.id, dataCorte)
      const limite = Number(socio.limite || 0)
      const margem = limite - descontos

      return NextResponse.json({
        socioId: socio.id,
        nome: socio.nome,
        matricula: socio.matricula,
        margem,
        limite,
        descontos,
        mesReferencia: `${dataCorte.mes}/${dataCorte.ano}`,
        fonte: 'local',
        tipo: socio.tipo,
      })
    }

    // REGRA AS200.PRG: Tipos != 3 e != 4 = Consulta ZETRA
    const matricula = socio.matricula || ''
    const cpf = socio.cpf || ''

    if (!cpf || !matricula) {
      // Sem CPF ou matrícula, usa margem do banco
      return NextResponse.json({
        socioId: socio.id,
        nome: socio.nome,
        matricula: socio.matricula,
        margem: Number(socio.margemConsig || 0),
        fonte: 'banco',
        tipo: socio.tipo,
        aviso: 'CPF ou matrícula não disponível para consulta ZETRA',
      })
    }

    const margemZetra = await consultarMargemZetra({
      matricula,
      cpf,
      valorParcela: valorParcelaParam,
    })

    if (margemZetra === null) {
      // Fallback para valor do banco
      return NextResponse.json({
        socioId: socio.id,
        nome: socio.nome,
        matricula: socio.matricula,
        margem: Number(socio.margemConsig || 0),
        fonte: 'fallback',
        tipo: socio.tipo,
        aviso: 'ZETRA indisponível, usando valor do banco',
      })
    }

    if (typeof margemZetra === 'object' && 'mensagem' in margemZetra) {
      return NextResponse.json({
        socioId: socio.id,
        nome: socio.nome,
        matricula: socio.matricula,
        margem: 0,
        fonte: 'zetra_erro',
        tipo: socio.tipo,
        mensagem: margemZetra.mensagem,
        codRetorno: margemZetra.codRetorno,
      })
    }
    // Busca convênio para o log
    const convenio = await prisma.convenio.findUnique({
      where: { id: session.convenioId },
      select: { razao_soc: true, fantasia: true }
    })

    // Registra consulta de margem no audit log
    await createAuditLog({
      userId: 'convenio-' + session.convenioId,
      userName: session.usuario,
      userRole: 'CONVENIO',
      action: 'VIEW',
      module: 'margem',
      entityId: socioId,
      entityName: socio.nome,
      description: `Consulta de margem pelo convênio ${convenio?.fantasia || convenio?.razao_soc || session.convenioId} - Sócio: ${socio.nome} (${socio.matricula})`,
      metadata: {
        convenioId: session.convenioId,
        convenioNome: convenio?.fantasia || convenio?.razao_soc,
        socioId: socio.id,
        socioNome: socio.nome,
        socioMatricula: socio.matricula,
        valorParcela: valorParcelaParam,
        fonte: typeof margemZetra === 'object' && 'mensagem' in margemZetra ? 'zetra_erro' : 
               margemZetra === null ? 'fallback' : 'tempo_real',
        margem: typeof margemZetra === 'object' && 'margem' in margemZetra ? margemZetra.margem : 
                margemZetra === null ? Number(socio.margemConsig || 0) : margemZetra,
      },
      ...requestInfo
    })
    return NextResponse.json({
      socioId: socio.id,
      nome: socio.nome,
      matricula: socio.matricula,
      margem: margemZetra || 0,
      fonte: 'tempo_real',
      tipo: socio.tipo,
    })
  } catch (error) {
    console.error('[CONVENIADO] Erro ao buscar margem:', error)
    return NextResponse.json({ error: 'Erro ao buscar margem' }, { status: 500 })
  }
}

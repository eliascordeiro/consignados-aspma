import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireConvenioSession } from '@/lib/convenio-auth'
import { createAuditLog, getRequestInfo } from '@/lib/audit-log'
import { calcularDataCorte } from '@/lib/data-corte'
import { formatCpf } from '@/lib/zetra-soap'

// URL base do serviço PHP Zetra
const ZETRA_BASE_URL = process.env.ZETRA_BASE_URL || 'http://200.98.112.240/aspma/php/zetra_desktop'

const ZETRA_CONFIG = {
  phpUrl: `${ZETRA_BASE_URL}/reservarMargemZetra.php`,
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

/**
 * Calcula o total de descontos (parcelas ativas) no mês de referência
 */
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
        OR: [{ baixa: '' }, { baixa: null }, { baixa: 'N' }],
        dataVencimento: {
          gte: new Date(dataCorte.ano, dataCorte.mes - 1, 1),
          lt: new Date(dataCorte.ano, dataCorte.mes, 1),
        },
      },
    })

    return Number(result._sum.valor || 0)
  } catch (error) {
    console.error('[VENDAS] Erro ao calcular descontos:', error)
    return 0
  }
}

/**
 * Calcula a data de vencimento da primeira parcela considerando a regra do dia 9
 * - Se dia > 9: primeira parcela vence no mês seguinte (dia 01)
 * - Se dia <= 9: primeira parcela vence no mês atual (dia 01)
 * 
 * IMPORTANTE: Usa sempre dia 01 porque para o convênio interessa o MÊS de desconto.
 * Evita problemas com meses de diferentes tamanhos (28, 29, 30, 31 dias).
 * Usa Date.UTC para evitar problemas de timezone.
 */
function calcularPrimeiroVencimento(diaCorte: number = 9): Date {
  const hoje = new Date()
  const dia = hoje.getDate()
  let mes = hoje.getMonth()
  let ano = hoje.getFullYear()

  // Se passou do dia de corte, primeira parcela vence no mês seguinte
  if (dia > diaCorte) {
    if (mes === 11) { // dezembro (0-indexed)
      mes = 0 // janeiro
      ano = ano + 1
    } else {
      mes = mes + 1
    }
  }

  // Define sempre para o dia 01 do mês às 12:00 UTC (padrão AS200.PRG)
  // Usa Date.UTC para evitar problemas de timezone ao salvar no banco
  return new Date(Date.UTC(ano, mes, 1, 12, 0, 0, 0))
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)
    const body = await request.json()
    const requestInfo = getRequestInfo(request)

    const {
      socioId,
      valorTotal,
      quantidadeParcelas,
      valorParcela,
      observacoes,
    } = body

    // Validações
    if (!socioId || !valorTotal || !quantidadeParcelas || !valorParcela) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Verifica se o sócio existe, está ativo e sem bloqueio
    const socio = await prisma.socio.findFirst({
      where: {
        id: socioId,
        ativo: true,
        OR: [
          { bloqueio: null },
          { bloqueio: '' },
          { bloqueio: 'N' },
        ],
      },
      include: { empresa: { select: { diaCorte: true } } },
    })

    if (!socio) {
      return NextResponse.json(
        { error: 'Sócio não encontrado, inativo ou bloqueado' },
        { status: 404 }
      )
    }

    // Busca o maior número de venda do sócio
    const ultimaVenda = await prisma.venda.findFirst({
      where: { socioId },
      orderBy: { numeroVenda: 'desc' },
      select: { numeroVenda: true },
    })

    const numeroVenda = (ultimaVenda?.numeroVenda || 0) + 1

    // Regra AS200.PRG: Reserva margem no ZETRA ANTES de salvar no banco
    // AS200.PRG: prefeitura := if(codtipo != "3" .and. codtipo != "4", .t., .f.)
    if (socio.tipo !== '3' && socio.tipo !== '4') {
      console.log(`🎯 [CONV VENDA] Sócio tipo ${socio.tipo} (não-pensionista) - Reservando margem no ZETRA...`)

      const adeIdentificador = `M${socio.matricula}S${numeroVenda}`

      try {
        const params = {
          cliente: ZETRA_CONFIG.cliente,
          convenio: ZETRA_CONFIG.convenio,
          usuario: ZETRA_CONFIG.usuario,
          senha: ZETRA_CONFIG.senha,
          matricula: socio.matricula || '',
          cpf: formatCpf(socio.cpf || ''),
          valorParcela: valorParcela.toString(),
          valorLiberado: valorParcela.toString(),
          prazo: quantidadeParcelas.toString(),
          codVerba: '441',
          servicoCodigo: '018',
          adeIdentificador: adeIdentificador,
        }

        console.log('📋 [CONV VENDA] Parâmetros ZETRA:', JSON.stringify(params, null, 2))

        const queryParams = new URLSearchParams(params)
        const urlWithParams = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`
        console.log('📤 [CONV VENDA] Chamando ZETRA PHP:', ZETRA_CONFIG.phpUrl)

        const zetraResponse = await fetch(urlWithParams, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: queryParams.toString(),
        })

        const xmlResponse = await zetraResponse.text()
        console.log('📥 [CONV VENDA] Resposta ZETRA (primeiros 500 chars):', xmlResponse.substring(0, 500))

        const sucesso = extractXmlValue('<ns10:sucesso>', '</ns10:sucesso>', xmlResponse)
        const mensagem = extractXmlValue('<ns10:mensagem>', '</ns10:mensagem>', xmlResponse)
        const codRetorno = extractXmlValue('<ns10:codRetorno>', '</ns10:codRetorno>', xmlResponse)

        console.log('📊 [CONV VENDA] Resultado ZETRA:', { sucesso, mensagem, codRetorno })

        if (!zetraResponse.ok || sucesso === 'false' || mensagem?.includes('FALHA') || mensagem?.includes('Erro')) {
          console.log('❌ [CONV VENDA] ZETRA recusou a reserva:', mensagem)
          return NextResponse.json(
            {
              error: 'ZETRA recusou a operação',
              mensagem: mensagem || 'Erro desconhecido',
              detalhes: 'A margem não pôde ser reservada no ZETRA. Venda não foi criada.',
            },
            { status: 400 }
          )
        }

        console.log('✅ [CONV VENDA] Margem reservada no ZETRA! Prosseguindo com salvamento...')
      } catch (zetraError) {
        console.error('❌ [CONV VENDA] Erro ao reservar margem no ZETRA:', zetraError)
        return NextResponse.json(
          {
            error: 'Erro ao reservar margem no ZETRA',
            detalhes: zetraError instanceof Error ? zetraError.message : 'Erro desconhecido',
          },
          { status: 500 }
        )
      }
    } else {
      console.log(`📝 [CONV VENDA] Sócio tipo ${socio.tipo} (pensionista) - Sem reserva ZETRA`)
    }

    // Busca convênio para obter userId do MANAGER dono do convênio
    // Isso é necessário para que o MANAGER veja as vendas feitas pelo convênio
    const convenioData = await prisma.convenio.findUnique({
      where: { id: session.convenioId },
      select: { userId: true, razao_soc: true, fantasia: true },
    })

    // Se o convênio tem userId (MANAGER dono), usa esse ID para que o MANAGER veja a venda
    // Caso contrário, mantém o ID virtual como fallback
    const vendaUserId = convenioData?.userId || ('convenio-' + session.convenioId)

    // Cria a venda
    const venda = await prisma.venda.create({
      data: {
        socioId,
        convenioId: session.convenioId,
        numeroVenda,
        valorTotal,
        quantidadeParcelas,
        valorParcela,
        observacoes,
        userId: vendaUserId,
        operador: session.usuario,
        ativo: true,
        cancelado: false,
        empresaId: socio.empresaId ?? null,
      },
    })

    // Cria as parcelas respeitando a data de corte
    const diaCorte = socio.empresa?.diaCorte ?? 9
    const primeiroVencimento = calcularPrimeiroVencimento(diaCorte)
    const parcelas = []

    for (let i = 0; i < quantidadeParcelas; i++) {
      // Calcula o mês de vencimento
      const mesVencimento = primeiroVencimento.getMonth() + i
      const anoVencimento = primeiroVencimento.getFullYear() + Math.floor(mesVencimento / 12)
      const mesAjustado = mesVencimento % 12

      // Cria data UTC para evitar problemas de timezone
      const dataVencimento = new Date(Date.UTC(anoVencimento, mesAjustado, 1, 12, 0, 0, 0))

      parcelas.push({
        vendaId: venda.id,
        numeroParcela: i + 1,
        dataVencimento,
        valor: valorParcela,
        baixa: 'N',
      })
    }

    await prisma.parcela.createMany({
      data: parcelas,
    })

    // Atualizar margemConsig do sócio (apenas para tipo 3 e 4 - cálculo local)
    if (socio.tipo === '3' || socio.tipo === '4') {
      const dataCorte = calcularDataCorte(socio.empresa?.diaCorte ?? 9)
      const descontos = await calcularDescontosDoMes(socio.id, dataCorte)
      const limite = Number(socio.limite || 0)
      const novaMargemConsig = limite - descontos

      await prisma.socio.update({
        where: { id: socio.id },
        data: { margemConsig: novaMargemConsig },
      })

      console.log(`✅ [VENDA] Margem atualizada - Sócio: ${socio.nome}, Limite: ${limite}, Descontos: ${descontos}, Nova Margem: ${novaMargemConsig}`)
    }

    // Reutiliza dado já buscado antes da criação da venda
    const convenio = convenioData

    // Registra no audit log
    await createAuditLog({
      userId: 'convenio-' + session.convenioId,
      userName: session.usuario,
      userRole: 'CONVENIO',
      action: 'CREATE',
      module: 'vendas',
      entityId: venda.id,
      entityName: `Venda #${venda.numeroVenda} - ${socio.nome}`,
      description: `Venda #${venda.numeroVenda} criada pelo convênio ${convenio?.fantasia || convenio?.razao_soc || session.convenioId} - Sócio: ${socio.nome}, Valor: R$ ${valorTotal}, Parcelas: ${quantidadeParcelas}x de R$ ${valorParcela}`,
      metadata: {
        convenioId: session.convenioId,
        convenioNome: convenio?.fantasia || convenio?.razao_soc,
        numeroVenda: venda.numeroVenda,
        socioId,
        socioNome: socio.nome,
        socioMatricula: socio.matricula,
        valorTotal,
        quantidadeParcelas,
        valorParcela,
        observacoes,
      },
      ...requestInfo
    })

    return NextResponse.json({
      success: true,
      venda: {
        id: venda.id,
        numeroVenda: venda.numeroVenda,
        valorTotal: venda.valorTotal,
        valorParcela: venda.valorParcela,
        quantidadeParcelas: venda.quantidadeParcelas,
        dataEmissao: venda.dataEmissao,
        operador: venda.operador,
      },
      socio: {
        nome: socio.nome,
        matricula: socio.matricula,
        cpf: socio.cpf,
      },
      convenio: {
        nome: convenio?.fantasia || convenio?.razao_soc || '',
      },
    })
  } catch (error) {
    console.error('Erro ao criar venda:', error)
    return NextResponse.json(
      { error: 'Erro ao criar venda' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🟢 [VENDAS API] Iniciando requisição')
    console.log('🟢 [VENDAS API] Headers:', Object.fromEntries(request.headers.entries()))
    console.log('🟢 [VENDAS API] Cookies:', request.cookies.getAll())
    
    const session = await requireConvenioSession(request)
    const requestInfo = getRequestInfo(request)
    console.log('🟢 [VENDAS API] Session obtida:', { convenioId: session.convenioId, usuario: session.usuario })

    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('busca')?.trim() || ''
    const status = searchParams.get('status') || '' // ativa, cancelada (quitada não usado no portal do convênio)
    const dataInicio = searchParams.get('dataInicio') || ''
    const dataFim = searchParams.get('dataFim') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      convenioId: session.convenioId,
    }

    // Filtro por nome ou matrícula do sócio
    if (busca) {
      where.socio = {
        OR: [
          { nome: { contains: busca, mode: 'insensitive' } },
          { matricula: { contains: busca, mode: 'insensitive' } },
          { cpf: { contains: busca, mode: 'insensitive' } },
        ],
      }
    }

    // Início do mês atual (UTC) — parcelas com vencimento anterior a isso são tratadas como pagas
    const agora = new Date()
    const inicioMesAtual = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), 1))

    // Filtro por status
    if (status === 'ativa') {
      where.ativo = true
      where.cancelado = false
      // Exclui vendas finalizadas (todas parcelas pagas ou vencidas no passado)
      where.parcelas = {
        some: {
          baixa: { not: 'S' },
          dataVencimento: { gte: inicioMesAtual },
        },
      }
    } else if (status === 'cancelada') {
      where.cancelado = true
    } else if (status === 'finalizada' || status === 'quitada') {
      where.ativo = true
      where.cancelado = false
      // Todas as parcelas pagas ou com vencimento em mês anterior
      where.parcelas = {
        every: {
          OR: [
            { baixa: 'S' },
            { dataVencimento: { lt: inicioMesAtual } },
          ],
        },
        some: {}, // garante que a venda tem pelo menos uma parcela
      }
    }

    // Filtro por data
    if (dataInicio || dataFim) {
      where.dataEmissao = {}
      if (dataInicio) {
        where.dataEmissao.gte = new Date(dataInicio + 'T00:00:00.000Z')
      }
      if (dataFim) {
        where.dataEmissao.lte = new Date(dataFim + 'T23:59:59.999Z')
      }
    }

    // Buscar vendas com paginação
    const [vendas, total] = await Promise.all([
      prisma.venda.findMany({
        where,
        include: {
          socio: {
            select: {
              nome: true,
              matricula: true,
              cpf: true,
            },
          },
          parcelas: {
            select: {
              baixa: true,
              valor: true,
              dataVencimento: true,
            },
          },
        },
        orderBy: {
          dataEmissao: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.venda.count({ where }),
    ])

    // Formatar resultado
    const resultado = vendas.map(venda => {
      // Conta parcelas pagas: baixa='S' OU vencimento em mês anterior ao atual
      // (em consignado, o desconto já foi feito no mês do vencimento)
      const parcelasPagas = venda.parcelas.filter(
        p => p.baixa === 'S' || new Date(p.dataVencimento) < inicioMesAtual
      ).length

      // Venda finalizada: não cancelada e todas as parcelas já pagas/vencidas
      const finalizada = !venda.cancelado && parcelasPagas >= venda.quantidadeParcelas

      return {
        id: venda.id,
        numeroVenda: venda.numeroVenda,
        dataEmissao: venda.dataEmissao,
        valorTotal: venda.valorTotal,
        quantidadeParcelas: venda.quantidadeParcelas,
        valorParcela: venda.valorParcela,
        observacoes: venda.observacoes,
        ativo: venda.ativo,
        cancelado: venda.cancelado,
        finalizada,
        socio: venda.socio,
        parcelasPagas,
        parcelas: venda.parcelas,
      }
    })

    // Calcula valores totais (usando os resultados paginados)
    const valorTotalParcelas = resultado.reduce((sum, venda) => {
      const valorVenda = venda.parcelas?.reduce((s: number, p: any) => s + Number(p.valor), 0) || 0
      return sum + valorVenda
    }, 0)

    const totalParcelas = resultado.reduce((sum, venda) => sum + (venda.parcelas?.length || 0), 0)

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      valorTotalGeral: resultado.reduce((sum, v) => sum + Number(v.valorTotal), 0),
      totalParcelas,
      valorTotalParcelas,
    }

    // Busca convênio para o log
    const convenio = await prisma.convenio.findUnique({
      where: { id: session.convenioId },
      select: { razao_soc: true, fantasia: true }
    })

    // Registra consulta no audit log (apenas se houver filtros aplicados)
    if (busca || status || dataInicio || dataFim) {
      await createAuditLog({
        userId: 'convenio-' + session.convenioId,
        userName: session.usuario,
        userRole: 'CONVENIO',
        action: 'VIEW',
        module: 'vendas',
        description: `Consulta de vendas pelo convênio ${convenio?.fantasia || convenio?.razao_soc || session.convenioId}`,
        metadata: {
          convenioId: session.convenioId,
          convenioNome: convenio?.fantasia || convenio?.razao_soc,
          filtros: { busca, status, dataInicio, dataFim },
          resultados: total,
          pagina: page,
        },
        ...requestInfo
      })
    }

    console.log('🟢 [VENDAS API] Retornando', resultado.length, 'vendas de', total, 'total')
    return NextResponse.json({ vendas: resultado, pagination })
  } catch (error) {
    console.error('❌ [VENDAS API] Erro ao buscar vendas:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar vendas' },
      { status: 500 }
    )
  }
}

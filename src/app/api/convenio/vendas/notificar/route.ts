import { NextRequest, NextResponse } from 'next/server'
import { requireConvenioSession } from '@/lib/convenio-auth'
import { prisma } from '@/lib/prisma'

/**
 * POST - Notificar sócio sobre venda criada via WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)

    const body = await request.json()
    const { vendaId, socioId } = body

    if (!vendaId || !socioId) {
      return NextResponse.json(
        { error: 'vendaId e socioId são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar dados da venda e do sócio
    const venda = await prisma.venda.findUnique({
      where: { id: vendaId },
      select: {
        numeroVenda: true,
        valorTotal: true,
        quantidadeParcelas: true,
        valorParcela: true,
        ativo: true,
        cancelado: true,
      },
    })

    if (!venda) {
      return NextResponse.json(
        { error: 'Venda não encontrada' },
        { status: 404 }
      )
    }

    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        nome: true,
        celular: true,
        telefone: true,
        margemConsig: true,
      },
    })

    if (!socio) {
      return NextResponse.json(
        { error: 'Sócio não encontrado' },
        { status: 404 }
      )
    }

    const celular = socio.celular || socio.telefone
    if (!celular) {
      return NextResponse.json(
        { error: 'Sócio não possui celular cadastrado' },
        { status: 400 }
      )
    }

    // Formatar número de telefone
    let phone = celular.replace(/\D/g, '')
    
    if (phone.length === 8 || phone.length === 9) {
      phone = '5541' + phone
    } else if (phone.length === 10 || phone.length === 11) {
      phone = '55' + phone
    } else if (!phone.startsWith('55')) {
      phone = '55' + phone
    }

    if (phone.length < 12 || phone.length > 13) {
      return NextResponse.json(
        { error: `Número de celular inválido: ${celular}` },
        { status: 400 }
      )
    }

    // Configuração WhatsGW
    const baseUrl = process.env.WHATSGW_URL || 'https://app.whatsgw.com.br'
    const apiKey = process.env.WHATSGW_API_KEY
    const phoneNumber = process.env.WHATSGW_PHONE_NUMBER || '5541988318343'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'WhatsGW não configurado' },
        { status: 500 }
      )
    }

    // margemConsig já está atualizada pelo sistema após criar a venda
    // Não precisa subtrair novamente o valor da parcela
    const limiteDisponivel = Number(socio.margemConsig) || 0

    // Calcular início e fim do desconto
    const hoje = new Date()
    const inicioDesconto = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1) // Próximo mês
    const fimDesconto = new Date(
      inicioDesconto.getFullYear(),
      inicioDesconto.getMonth() + venda.quantidadeParcelas - 1,
      1
    )

    const formatarMesAno = (data: Date) => {
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      return `${meses[data.getMonth()]}/${data.getFullYear()}`
    }

    // Link do Portal do Sócio
    const appUrl = (process.env.NEXTAUTH_URL || 'https://portal.aspma.com.br').replace(/\/$/, '')
    const portalUrl = `${appUrl}/portal/login`

    // Pegar o primeiro nome para um tom mais próximo
    const primeiroNome = socio.nome.trim().split(/\s+/)[0]

    // Montar mensagem de confirmação
    const messageCustomId = `venda-confirmacao-${Date.now()}`
    let mensagem = `✅ *ASPMA - Venda Confirmada*\n\n`
    mensagem += `Olá, *${primeiroNome}*! Sua compra consignada foi registrada com sucesso. 🎉\n\n`
    mensagem += `*Resumo da sua compra*\n`
    mensagem += `📋 Número da venda: #${venda.numeroVenda}\n`
    mensagem += `💰 Valor total: R$ ${Number(venda.valorTotal).toFixed(2).replace('.', ',')}\n`
    mensagem += `📅 Parcelas: ${venda.quantidadeParcelas}x de R$ ${Number(venda.valorParcela).toFixed(2).replace('.', ',')}\n`
    mensagem += `📆 Descontos de ${formatarMesAno(inicioDesconto)} até ${formatarMesAno(fimDesconto)}\n`
    mensagem += `💳 Margem disponível por parcela: R$ ${limiteDisponivel.toFixed(2).replace('.', ',')}\n\n`
    mensagem += `🌐 *Acesse o Portal do Sócio*\n`
    mensagem += `Acompanhe suas compras, parcelas, descontos e margem disponível quando quiser, direto no seu celular ou computador:\n`
    mensagem += `${portalUrl}\n\n`
    mensagem += `🔑 É só entrar com o seu número de celular. No primeiro acesso, você cria a sua senha em poucos segundos.\n\n`
    mensagem += `💬 *Precisa de ajuda?* Basta responder esta mensagem e nosso assistente virtual te atende na hora. Para falar com um atendente humano, é só pedir!\n\n`
    mensagem += `Qualquer dúvida, estamos à disposição. Obrigado por confiar na ASPMA! 💚`

    const payload = {
      apikey: apiKey,
      phone_number: phoneNumber,
      contact_phone_number: phone,
      message_custom_id: messageCustomId,
      message_type: 'text',
      message_body: mensagem,
    }

    console.log('📤 [WhatsGW] Enviando confirmação de venda para:', phone)

    const response = await fetch(`${baseUrl}/api/WhatsGw/Send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log('📥 [WhatsGW] Resposta:', data)

    if (data.result !== 'success') {
      console.error('❌ [WhatsGW] Erro ao enviar:', data)
      // Não retornar erro para não bloquear o fluxo
      return NextResponse.json({
        success: false,
        message: 'Venda criada mas falha ao enviar notificação',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Notificação enviada com sucesso',
      celularEnviado: phone,
    })
  } catch (error: any) {
    console.error('❌ [API] Erro ao notificar venda:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao notificar venda' },
      { status: 500 }
    )
  }
}

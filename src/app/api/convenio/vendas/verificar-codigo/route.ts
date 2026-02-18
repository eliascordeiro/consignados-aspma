import { NextRequest, NextResponse } from 'next/server'
import { requireConvenioSession } from '@/lib/convenio-auth'

// Armazenamento temporário dos códigos (em memória - reseta no deploy)
// Em produção, idealmente usar Redis ou banco de dados
const codigosEnviados = new Map<string, { codigo: string; expira: number; socioId: string; celular: string }>()

// Limpar códigos expirados a cada 5 min
setInterval(() => {
  const agora = Date.now()
  for (const [key, value] of codigosEnviados) {
    if (agora > value.expira) {
      codigosEnviados.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * POST - Enviar código de verificação via WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)

    const body = await request.json()
    const { socioId, celular } = body

    if (!socioId || !celular) {
      return NextResponse.json(
        { error: 'Sócio e celular são obrigatórios' },
        { status: 400 }
      )
    }

    // Gerar código de 6 dígitos
    const codigo = String(Math.floor(100000 + Math.random() * 900000))

    // Limpar número (apenas dígitos)
    let phone = celular.replace(/\D/g, '')
    
    // Adicionar DDI se não tiver
    if (!phone.startsWith('55')) {
      phone = '55' + phone
    }

    // Configuração WhatsGW
    const baseUrl = process.env.WHATSGW_URL || 'https://app.whatsgw.com.br'
    const apiKey = process.env.WHATSGW_API_KEY
    const phoneNumber = process.env.WHATSGW_PHONE_NUMBER || '5541988318343'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'WhatsGW não configurado. Configure WHATSGW_API_KEY.' },
        { status: 500 }
      )
    }

    // Enviar mensagem via WhatsGW
    const messageCustomId = `venda-code-${Date.now()}`
    const mensagem = `🔐 *ASPMA - Código de Verificação*\n\nSeu código para autorizar a venda consignada é:\n\n*${codigo}*\n\nVálido por 10 minutos.\n\n⚠️ Não compartilhe este código.`

    const payload = {
      apikey: apiKey,
      phone_number: phoneNumber,
      contact_phone_number: phone,
      message_custom_id: messageCustomId,
      message_type: 'text',
      message_body: mensagem,
    }

    console.log('📤 [WhatsGW] Enviando código de verificação para:', phone)

    const response = await fetch(`${baseUrl}/api/WhatsGw/Send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log('📥 [WhatsGW] Resposta:', data)

    if (data.result !== 'success') {
      return NextResponse.json(
        { error: 'Erro ao enviar código via WhatsApp: ' + (data.error || 'Falha no envio') },
        { status: 400 }
      )
    }

    // Salvar código (expira em 10 min)
    const chave = `${session.convenioId}-${socioId}`
    codigosEnviados.set(chave, {
      codigo,
      expira: Date.now() + 10 * 60 * 1000,
      socioId,
      celular: phone,
    })

    console.log('✅ [WhatsGW] Código enviado com sucesso para', phone)

    return NextResponse.json({
      success: true,
      message: 'Código enviado via WhatsApp',
      celularEnviado: phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4'),
    })
  } catch (error: any) {
    console.error('❌ [WhatsGW] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar código' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Validar código digitado pelo usuário
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireConvenioSession(request)

    const body = await request.json()
    const { socioId, codigo } = body

    if (!socioId || !codigo) {
      return NextResponse.json(
        { error: 'Sócio e código são obrigatórios' },
        { status: 400 }
      )
    }

    const chave = `${session.convenioId}-${socioId}`
    const registro = codigosEnviados.get(chave)

    if (!registro) {
      return NextResponse.json(
        { error: 'Nenhum código foi enviado para este sócio. Envie um novo código.' },
        { status: 400 }
      )
    }

    if (Date.now() > registro.expira) {
      codigosEnviados.delete(chave)
      return NextResponse.json(
        { error: 'Código expirado. Solicite um novo código.' },
        { status: 400 }
      )
    }

    if (registro.codigo !== codigo.trim()) {
      return NextResponse.json(
        { error: 'Código inválido. Verifique e tente novamente.' },
        { status: 400 }
      )
    }

    // Código válido - remover para não reutilizar
    codigosEnviados.delete(chave)

    return NextResponse.json({
      success: true,
      message: 'Código validado com sucesso',
    })
  } catch (error: any) {
    console.error('❌ Erro na validação do código:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao validar código' },
      { status: 500 }
    )
  }
}

/**
 * WhatGW Client para o Portal do Sócio
 * Env vars: WHATSGW_BASE_URL, WHATSGW_API_KEY, WHATSGW_PHONE_NUMBER
 */

interface SendResult {
  success: boolean
  error?: string
}

export async function sendWhatsApp(celular: string, message: string): Promise<SendResult> {
  // Aceita WHATSGW_URL ou WHATSGW_BASE_URL (compatibilidade)
  const baseUrl = process.env.WHATSGW_URL || process.env.WHATSGW_BASE_URL || 'https://app.whatsgw.com.br'
  const apiKey = process.env.WHATSGW_API_KEY
  const phoneNumber = process.env.WHATSGW_PHONE_NUMBER || '5541988318343'

  if (!apiKey) {
    console.warn('[WhatGW] WHATSGW_API_KEY não configurada — WhatsApp desabilitado')
    return { success: false, error: 'WhatGW não configurado' }
  }

  // Normaliza para apenas dígitos, garante DDI 55
  const phone = celular.replace(/\D/g, '')
  const dest = phone.startsWith('55') ? phone : `55${phone}`

  try {
    const res = await fetch(`${baseUrl}/api/WhatsGw/Send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        phone_number: phoneNumber,
        contact_phone_number: dest,
        message_custom_id: `portal-${Date.now()}`,
        message_type: 'text',
        message_body: message,
      }),
    })

    const data = await res.json()
    if (data.result === 'success') return { success: true }
    return { success: false, error: data.error || 'Erro WhatGW' }
  } catch (err) {
    console.error('[WhatGW] Erro:', err)
    return { success: false, error: 'Falha na requisição WhatGW' }
  }
}

// ============================================================
// List Buttons (menu interativo do WhatsApp Business via WhatsGW)
// ============================================================
export interface ListRow {
  id: string
  title: string // máx 24 chars
  description?: string // máx 72 chars
}
export interface ListSection {
  title: string // máx 24 chars
  rows: ListRow[] // máx 10 itens por seção
}

/**
 * Envia mensagem com lista interativa de botões (WhatsApp Business).
 * Quando o usuário toca em um item, o WhatsApp envia o `id` como mensagem
 * de texto comum no webhook (será detectado pelo intent normal).
 *
 * Documentação: https://documenter.getpostman.com/view/3741041/SztBa7ku
 */
export async function sendWhatsAppListButtons(
  celular: string,
  body: string,
  options: {
    sections: ListSection[]
    buttonText?: string // texto do botão que abre a lista (máx 20 chars)
    title?: string
    footer?: string
  }
): Promise<SendResult> {
  const baseUrl = process.env.WHATSGW_URL || process.env.WHATSGW_BASE_URL || 'https://app.whatsgw.com.br'
  const apiKey = process.env.WHATSGW_API_KEY
  const phoneNumber = process.env.WHATSGW_PHONE_NUMBER || '5541988318343'

  if (!apiKey) return { success: false, error: 'WhatGW não configurado' }

  const phone = celular.replace(/\D/g, '')
  const dest = phone.startsWith('55') ? phone : `55${phone}`

  try {
    const res = await fetch(`${baseUrl}/api/WhatsGw/Send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        phone_number: phoneNumber,
        contact_phone_number: dest,
        message_custom_id: `portal-list-${Date.now()}`,
        message_type: 'text',
        message_body: body,
        listButton: {
          listType: 1,
          buttonText: options.buttonText || 'Ver opções',
          title: options.title || '',
          footerText: options.footer || '',
          description: body,
          sections: options.sections,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.result === 'success') return { success: true }
    return { success: false, error: data.error || 'Erro WhatGW (list)' }
  } catch (err) {
    console.error('[WhatGW] Erro list:', err)
    return { success: false, error: 'Falha na requisição WhatGW (list)' }
  }
}

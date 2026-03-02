/**
 * WhatGW Client para o Portal do Sócio
 * Env vars: WHATSGW_BASE_URL, WHATSGW_API_KEY, WHATSGW_PHONE_NUMBER
 */

interface SendResult {
  success: boolean
  error?: string
}

export async function sendWhatsApp(celular: string, message: string): Promise<SendResult> {
  const baseUrl = process.env.WHATSGW_BASE_URL
  const apiKey = process.env.WHATSGW_API_KEY
  const phoneNumber = process.env.WHATSGW_PHONE_NUMBER

  if (!baseUrl || !apiKey || !phoneNumber) {
    console.warn('[WhatGW] Variáveis de ambiente não configuradas — WhatsApp desabilitado')
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

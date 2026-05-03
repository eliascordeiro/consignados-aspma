import { NextRequest, NextResponse } from 'next/server'
import { processMessage } from '@/lib/chatbot/processor'
import { sendWhatsApp } from '@/lib/whatsgw'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook de entrada de mensagens WhatsApp (provedor WhatsGW).
 * Configure no painel WhatsGW: URL = /api/whatsapp/webhook
 * Header obrigatório: X-Webhook-Token = WHATSGW_WEBHOOK_TOKEN
 *
 * Para desabilitar temporariamente o bot: CHATBOT_ENABLED=false
 */
export async function POST(req: NextRequest) {
  // Autenticação simples por token de header (definido no painel WhatsGW)
  const expected = process.env.WHATSGW_WEBHOOK_TOKEN
  if (expected) {
    const provided = req.headers.get('x-webhook-token') || req.nextUrl.searchParams.get('token')
    if (provided !== expected) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  if (process.env.CHATBOT_ENABLED && process.env.CHATBOT_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, disabled: true })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  // Suporta payload do WhatsGW (vários formatos possíveis)
  const phone =
    body?.contact_phone_number ||
    body?.phone ||
    body?.from ||
    body?.message?.from ||
    ''
  const text =
    body?.message_body ||
    body?.message ||
    body?.text ||
    body?.message?.text?.body ||
    ''
  const providerMessageId =
    body?.message_id ||
    body?.id ||
    body?.message?.id ||
    `auto-${Date.now()}`

  // Ignora eventos que não são mensagens de texto recebidas
  const eventType = body?.event || body?.type || 'message'
  const isInbound = !body?.from_me && (eventType === 'message' || eventType === 'webhookReceived' || !!text)

  if (!phone || !text || !isInbound) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const result = await processMessage({
      phone: String(phone),
      text: String(text),
      providerMessageId: String(providerMessageId),
      provider: 'whatsgw',
    })
    if (result.reply) {
      await sendWhatsApp(String(phone), result.reply)
    }
    return NextResponse.json({ ok: true, state: result.nextState, handoff: result.handoff })
  } catch (err: any) {
    console.error('[whatsapp/webhook] erro:', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/whatsapp/webhook',
    method: 'POST',
    auth: 'X-Webhook-Token: WHATSGW_WEBHOOK_TOKEN',
    enabled: process.env.CHATBOT_ENABLED !== 'false',
  })
}

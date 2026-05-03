import { NextRequest, NextResponse } from 'next/server'
import { processMessage } from '@/lib/chatbot/processor'
import { sendWhatsApp } from '@/lib/whatsgw'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Diagnóstico em memória — guarda os últimos N payloads recebidos para inspeção via GET
type DebugEntry = { receivedAt: string; method: string; query: Record<string, string>; headers: Record<string, string>; bodyText: string; bodyJson: unknown }
const DEBUG_BUFFER: DebugEntry[] = []
const DEBUG_MAX = 10
function pushDebug(e: DebugEntry) {
  DEBUG_BUFFER.unshift(e)
  if (DEBUG_BUFFER.length > DEBUG_MAX) DEBUG_BUFFER.pop()
}

/**
 * Webhook de entrada de mensagens WhatsApp (provedor WhatsGW).
 * Configure no painel WhatsGW: URL = /api/whatsapp/webhook
 * Header obrigatório: X-Webhook-Token = WHATSGW_WEBHOOK_TOKEN
 *
 * Para desabilitar temporariamente o bot: CHATBOT_ENABLED=false
 */
export async function POST(req: NextRequest) {
  // Captura raw body PRIMEIRO para diagnóstico (mesmo se autenticação falhar)
  const rawText = await req.text()
  const headersObj: Record<string, string> = {}
  req.headers.forEach((v, k) => { headersObj[k] = v })
  const queryObj: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((v, k) => { queryObj[k] = v })

  let body: any = null
  try {
    if (rawText) {
      const ct = (req.headers.get('content-type') || '').toLowerCase()
      if (ct.includes('application/x-www-form-urlencoded') || (rawText.includes('=') && !rawText.trim().startsWith('{'))) {
        // WhatsGW envia form-urlencoded
        const params = new URLSearchParams(rawText)
        body = {} as Record<string, any>
        params.forEach((v, k) => { body[k] = v })
        // Tenta parsear additional_infos como JSON aninhado
        if (typeof body.additional_infos === 'string') {
          try { body.additional_infos = JSON.parse(body.additional_infos) } catch {}
        }
      } else {
        body = JSON.parse(rawText)
      }
    }
  } catch { body = null }

  pushDebug({
    receivedAt: new Date().toISOString(),
    method: 'POST',
    query: queryObj,
    headers: headersObj,
    bodyText: rawText.slice(0, 4000),
    bodyJson: body,
  })
  console.log('[whatsapp/webhook] payload recebido:', JSON.stringify({ query: queryObj, body }).slice(0, 2000))

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

  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  // Suporta payload do WhatsGW (vários formatos possíveis) — busca também em campos aninhados
  const phone =
    body?.contact_phone_number ||
    body?.contactPhoneNumber ||
    body?.phone ||
    body?.from ||
    body?.message?.from ||
    body?.data?.contact_phone_number ||
    body?.data?.from ||
    ''
  const text =
    body?.message_body ||
    body?.messageBody ||
    body?.message ||
    body?.text ||
    body?.body ||
    body?.message?.text?.body ||
    body?.data?.message_body ||
    body?.data?.body ||
    ''
  const providerMessageId =
    body?.message_id ||
    body?.messageId ||
    body?.id ||
    body?.message?.id ||
    body?.data?.message_id ||
    `auto-${Date.now()}`

  // Ignora eventos que não são mensagens de texto recebidas
  const eventType = body?.event || body?.type || body?.data?.event || 'message'
  const direction = String(body?.message_direction || body?.direction || '').toLowerCase()
  const fromMe =
    body?.from_me === true ||
    body?.fromMe === true ||
    body?.data?.from_me === true ||
    direction === 'sent' ||
    body?.additional_infos?.key?.fromMe === true
  const isInbound = !fromMe && (
    eventType === 'message' ||
    eventType === 'webhookReceived' ||
    eventType === 'messageReceived' ||
    eventType === 'NewMessage' ||
    direction === 'received' ||
    !!text
  )

  if (!phone || !text || !isInbound) {
    return NextResponse.json({ ok: true, ignored: true, debug: { phone: !!phone, text: !!text, eventType, fromMe } })
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

export async function GET(req: NextRequest) {
  // Modo diagnóstico: GET ?debug=token mostra os últimos payloads recebidos
  const debug = req.nextUrl.searchParams.get('debug')
  if (debug && debug === process.env.WHATSGW_WEBHOOK_TOKEN) {
    return NextResponse.json({ count: DEBUG_BUFFER.length, entries: DEBUG_BUFFER })
  }
  return NextResponse.json({
    endpoint: '/api/whatsapp/webhook',
    method: 'POST',
    auth: 'X-Webhook-Token: WHATSGW_WEBHOOK_TOKEN',
    enabled: process.env.CHATBOT_ENABLED !== 'false',
    debugHint: 'GET ?debug=<WHATSGW_WEBHOOK_TOKEN> para ver últimos payloads',
  })
}

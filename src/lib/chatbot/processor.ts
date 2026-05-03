import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/whatsgw'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { brl, isValidCpf, maskCpf, normalizePhoneE164BR, onlyDigits, parseBirthDate, sameDateUTC, sha256Hex } from './util'
import { detectIntent } from './intents'
import { MSG } from './messages'

const SESSION_TTL_MS = 15 * 60 * 1000
const OTP_TTL_MS = 5 * 60 * 1000
const OTP_MAX_ATTEMPTS = 3

export type ProcessInput = {
  phone: string
  text: string
  providerMessageId: string
  provider?: string
}

export type ProcessResult = {
  reply: string | null
  nextState: string
  handoff: boolean
  ignored?: boolean
}

function newExpiry() {
  return new Date(Date.now() + SESSION_TTL_MS)
}

async function getOrCreateSession(phone: string) {
  const phoneE164 = normalizePhoneE164BR(phone)
  const existing = await db.chatSession.findFirst({
    where: { phoneE164 },
    orderBy: { updatedAt: 'desc' },
  })
  const now = new Date()
  if (existing && existing.expiresAt > now) return existing
  // Sessão expirada ou inexistente: cria nova
  return db.chatSession.create({
    data: {
      phoneE164,
      state: 'NEW',
      authLevel: 'L0',
      expiresAt: newExpiry(),
    },
  })
}

async function logIncoming(sessionId: string, providerMessageId: string, provider: string, text: string, intent: string | null) {
  try {
    await db.chatMessage.create({
      data: {
        sessionId,
        provider,
        providerMessageId,
        direction: 'in',
        textBody: text,
        intent,
      },
    })
    return true
  } catch (e: any) {
    // Conflito = duplicata (idempotência)
    if (e?.code === 'P2002') return false
    console.error('[chatbot] erro ao registrar inbound:', e?.message)
    return true
  }
}

async function logOutgoing(sessionId: string, text: string, intent: string | null) {
  try {
    await db.chatMessage.create({
      data: {
        sessionId,
        provider: 'whatsgw',
        providerMessageId: `out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        direction: 'out',
        textBody: text,
        intent,
      },
    })
  } catch (e: any) {
    console.error('[chatbot] erro ao registrar outbound:', e?.message)
  }
}

async function setState(
  sessionId: string,
  data: Partial<{ state: string; authLevel: string; socioId: string | null; cpfHash: string | null; lastIntent: string | null }>
) {
  await db.chatSession.update({
    where: { id: sessionId },
    data: { ...data, expiresAt: newExpiry() },
  })
}

async function openHandoff(sessionId: string, reason: string) {
  await db.chatHandoff.create({ data: { sessionId, reason } })
  await setState(sessionId, { state: 'HANDOFF' })
}

function generateOtpCode(): string {
  // 6 dígitos
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

async function createAndSendOtp(sessionId: string, phoneE164: string): Promise<void> {
  // Invalida OTPs anteriores não consumidos
  await db.chatOtp.updateMany({
    where: { sessionId, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  const code = generateOtpCode()
  const codeHash = await bcrypt.hash(code, 8)
  await db.chatOtp.create({
    data: {
      sessionId,
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })
  await sendWhatsApp(
    phoneE164,
    `🔐 Seu código de verificação ASPMA é *${code}*. Validade: 5 minutos. Não compartilhe com ninguém.`
  )
}

async function verifyOtp(sessionId: string, input: string): Promise<{ ok: boolean; remaining: number; expired: boolean }> {
  const otp = await db.chatOtp.findFirst({
    where: { sessionId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) return { ok: false, remaining: 0, expired: true }
  if (otp.expiresAt < new Date()) {
    await db.chatOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
    return { ok: false, remaining: 0, expired: true }
  }
  const ok = await bcrypt.compare(onlyDigits(input), otp.codeHash)
  if (ok) {
    await db.chatOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
    return { ok: true, remaining: OTP_MAX_ATTEMPTS - otp.attempts, expired: false }
  }
  const newAttempts = otp.attempts + 1
  await db.chatOtp.update({ where: { id: otp.id }, data: { attempts: newAttempts } })
  const remaining = Math.max(0, OTP_MAX_ATTEMPTS - newAttempts)
  return { ok: false, remaining, expired: false }
}

async function findSocioByCpf(cpf: string) {
  const c = onlyDigits(cpf)
  // Tenta achar por cpf cru ou formatado
  const formatted = `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
  return db.socio.findFirst({
    where: {
      ativo: true,
      OR: [{ cpf: c }, { cpf: formatted }],
    },
  })
}

async function consultarMargemSocio(socio: { matricula: string | null; cpf: string | null }) {
  if (!socio.matricula || !socio.cpf) return null
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/zetra/consultar-margem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula: socio.matricula, cpf: socio.cpf, valorParcela: '100.00' }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) return null
    return {
      margem: Number(data.margem || 0),
      detalhes: data.detalhes,
    }
  } catch (e) {
    console.error('[chatbot] erro consultar margem:', e)
    return null
  }
}

function formatMargemReply(socioNome: string, margem: number): string {
  const linhas = [
    `Olá, *${socioNome.split(' ')[0]}*! Aqui estão seus dados:`,
    '',
    `💰 *Margem disponível:* ${brl(margem)}`,
    '',
    'O que deseja fazer agora?',
    '1) Simular crédito',
    '2) Falar com atendente',
    '3) Encerrar',
  ]
  return linhas.join('\n')
}

export async function processMessage(input: ProcessInput): Promise<ProcessResult> {
  const text = (input.text || '').trim()
  if (!text) return { reply: null, nextState: 'NEW', handoff: false, ignored: true }

  const session = await getOrCreateSession(input.phone)
  const intent = detectIntent(text)

  // Idempotência: se já registramos esse provider_message_id, não responde de novo
  const isNew = await logIncoming(session.id, input.providerMessageId, input.provider || 'whatsgw', text, intent)
  if (!isNew) return { reply: null, nextState: session.state, handoff: false, ignored: true }

  // Comandos globais sempre disponíveis
  if (intent === 'ATENDENTE') {
    await openHandoff(session.id, 'USER_REQUESTED_AGENT')
    const reply = MSG.handoff()
    await logOutgoing(session.id, reply, 'ATENDENTE')
    return { reply, nextState: 'HANDOFF', handoff: true }
  }
  if (intent === 'CANCELAR') {
    await setState(session.id, { state: 'CLOSED' })
    const reply = MSG.encerrar()
    await logOutgoing(session.id, reply, 'CANCELAR')
    return { reply, nextState: 'CLOSED', handoff: false }
  }
  if (intent === 'MENU' && session.state !== 'AWAITING_CPF' && session.state !== 'AWAITING_BIRTHDATE' && session.state !== 'OTP_SENT') {
    await setState(session.id, { state: 'AWAITING_INTENT' })
    const reply = MSG.saudacao()
    await logOutgoing(session.id, reply, 'MENU')
    return { reply, nextState: 'AWAITING_INTENT', handoff: false }
  }

  switch (session.state) {
    case 'NEW':
    case 'AWAITING_INTENT':
    case 'CLOSED':
    case 'HANDOFF': {
      if (intent === 'MARGEM') {
        await setState(session.id, { state: 'AWAITING_CPF', lastIntent: 'MARGEM' })
        const reply = MSG.pedirCpf()
        await logOutgoing(session.id, reply, 'MARGEM')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      if (intent === 'STATUS_PROPOSTA' || intent === 'SEGUNDA_VIA' || intent === 'HORARIO') {
        await openHandoff(session.id, `INTENT_${intent}`)
        const reply = MSG.emConstrucao(
          intent === 'STATUS_PROPOSTA' ? 'Status da proposta' : intent === 'SEGUNDA_VIA' ? '2ª via' : 'Horário/atendimento'
        ) + '\n\n' + MSG.handoff()
        await logOutgoing(session.id, reply, intent)
        return { reply, nextState: 'HANDOFF', handoff: true }
      }
      // Sem intenção clara
      const reply = session.state === 'NEW' ? MSG.saudacao() : MSG.fallback()
      await setState(session.id, { state: 'AWAITING_INTENT' })
      await logOutgoing(session.id, reply, intent)
      return { reply, nextState: 'AWAITING_INTENT', handoff: false }
    }

    case 'AWAITING_CPF': {
      if (!isValidCpf(text)) {
        const reply = MSG.cpfInvalido()
        await logOutgoing(session.id, reply, 'AWAITING_CPF')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      const cpfDigits = onlyDigits(text)
      await setState(session.id, { cpfHash: sha256Hex(cpfDigits), state: 'AWAITING_BIRTHDATE' })
      const reply = MSG.pedirNascimento()
      await logOutgoing(session.id, `[CPF informado: ${maskCpf(cpfDigits)}] ` + reply, 'AWAITING_CPF')
      return { reply, nextState: 'AWAITING_BIRTHDATE', handoff: false }
    }

    case 'AWAITING_BIRTHDATE': {
      const dt = parseBirthDate(text)
      if (!dt) {
        const reply = MSG.nascimentoInvalido()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'AWAITING_BIRTHDATE', handoff: false }
      }
      // Carrega cpfHash da sessão e tenta localizar o sócio
      const fresh = await db.chatSession.findUnique({ where: { id: session.id } })
      if (!fresh?.cpfHash) {
        await setState(session.id, { state: 'AWAITING_CPF' })
        const reply = MSG.pedirCpf()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      // Localiza pelo cpf informado pelo usuário (recuperado da última msg in com intent AWAITING_CPF? — armazenamos cpfHash, não cpf cru)
      // Estratégia: o CPF cru não foi guardado; usamos a última mensagem inbound do usuário que era CPF.
      const lastCpfMsg = await db.chatMessage.findFirst({
        where: { sessionId: session.id, direction: 'in', intent: 'UNKNOWN' },
        orderBy: { createdAt: 'desc' },
      })
      const cpfCandidate = lastCpfMsg?.textBody ? onlyDigits(lastCpfMsg.textBody) : ''
      // Confirma que bate com o hash
      if (!cpfCandidate || sha256Hex(cpfCandidate) !== fresh.cpfHash) {
        // Recomeça a coleta
        await setState(session.id, { state: 'AWAITING_CPF', cpfHash: null })
        const reply = MSG.pedirCpf()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }

      const socio = await findSocioByCpf(cpfCandidate)
      if (!socio || !socio.dataNascimento || !sameDateUTC(socio.dataNascimento, dt)) {
        await openHandoff(session.id, 'AUTH_FAILED')
        const reply = MSG.socioNaoEncontrado()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'HANDOFF', handoff: true }
      }

      // Vincula sócio à sessão e envia OTP
      await setState(session.id, { socioId: socio.id, state: 'OTP_SENT' })
      await createAndSendOtp(session.id, normalizePhoneE164BR(input.phone))
      const reply = MSG.otpEnviado()
      await logOutgoing(session.id, reply, 'OTP_SENT')
      return { reply, nextState: 'OTP_SENT', handoff: false }
    }

    case 'OTP_SENT': {
      const v = await verifyOtp(session.id, text)
      if (v.expired) {
        await setState(session.id, { state: 'AWAITING_CPF', cpfHash: null, socioId: null })
        const reply = MSG.otpExpirado() + '\n' + MSG.pedirCpf()
        await logOutgoing(session.id, reply, 'OTP_SENT')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      if (!v.ok) {
        if (v.remaining <= 0) {
          await openHandoff(session.id, 'OTP_BLOCKED')
          const reply = MSG.bloqueado()
          await logOutgoing(session.id, reply, 'OTP_SENT')
          return { reply, nextState: 'HANDOFF', handoff: true }
        }
        const reply = MSG.otpInvalido(v.remaining)
        await logOutgoing(session.id, reply, 'OTP_SENT')
        return { reply, nextState: 'OTP_SENT', handoff: false }
      }

      // Autenticado → busca margem
      await setState(session.id, { state: 'AUTHENTICATED', authLevel: 'L2' })
      const fresh = await db.chatSession.findUnique({
        where: { id: session.id },
        include: { socio: true },
      })
      const socio = fresh?.socio
      if (!socio) {
        await openHandoff(session.id, 'SOCIO_NOT_LINKED')
        const reply = MSG.handoff()
        await logOutgoing(session.id, reply, 'AUTHENTICATED')
        return { reply, nextState: 'HANDOFF', handoff: true }
      }
      const margem = await consultarMargemSocio({ matricula: socio.matricula, cpf: socio.cpf })
      if (!margem) {
        await openHandoff(session.id, 'MARGEM_API_FAIL')
        const reply = 'Não consegui consultar sua margem agora. Vou te transferir para um atendente.'
        await logOutgoing(session.id, reply, 'MARGEM')
        return { reply, nextState: 'HANDOFF', handoff: true }
      }
      const reply = formatMargemReply(socio.nome || 'sócio', margem.margem)
      await setState(session.id, { state: 'ANSWERED', lastIntent: 'MARGEM' })
      await logOutgoing(session.id, reply, 'MARGEM')
      return { reply, nextState: 'ANSWERED', handoff: false }
    }

    case 'ANSWERED': {
      // Atalhos pós-resposta
      if (/^\s*1\s*$/.test(text)) {
        const reply = MSG.emConstrucao('Simulação de crédito') + '\n\n' + MSG.fallback()
        await logOutgoing(session.id, reply, 'ANSWERED')
        return { reply, nextState: 'AWAITING_INTENT', handoff: false }
      }
      if (/^\s*2\s*$/.test(text)) {
        await openHandoff(session.id, 'USER_REQUESTED_AGENT')
        const reply = MSG.handoff()
        await logOutgoing(session.id, reply, 'ANSWERED')
        return { reply, nextState: 'HANDOFF', handoff: true }
      }
      if (/^\s*3\s*$/.test(text)) {
        await setState(session.id, { state: 'CLOSED' })
        const reply = MSG.encerrar()
        await logOutgoing(session.id, reply, 'ANSWERED')
        return { reply, nextState: 'CLOSED', handoff: false }
      }
      // Outras intenções recomeçam fluxo
      await setState(session.id, { state: 'AWAITING_INTENT' })
      const reply = MSG.fallback()
      await logOutgoing(session.id, reply, 'ANSWERED')
      return { reply, nextState: 'AWAITING_INTENT', handoff: false }
    }

    default: {
      await setState(session.id, { state: 'AWAITING_INTENT' })
      const reply = MSG.fallback()
      await logOutgoing(session.id, reply, intent)
      return { reply, nextState: 'AWAITING_INTENT', handoff: false }
    }
  }
}

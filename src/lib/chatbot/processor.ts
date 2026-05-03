import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/whatsgw'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { brl, isValidCpf, normalizePhoneE164BR, onlyDigits, parseBirthDate, sameDateUTC } from './util'
import { detectIntent } from './intents'
import { MSG } from './messages'
import { groqChat } from './groq'

// Janela curta de histórico para alimentar o LLM
async function recentHistory(sessionId: string, take = 6) {
  const rows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { direction: true, textBody: true },
  })
  return rows
    .reverse()
    .map((r) => ({ role: r.direction === 'in' ? ('user' as const) : ('assistant' as const), content: r.textBody || '' }))
    .filter((r) => r.content.trim().length > 0)
}

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
  menu?: boolean // sinaliza ao webhook que pode enviar como List Buttons
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

async function getSessionSocioName(sessionId: string): Promise<string | undefined> {
  try {
    const s = await db.chatSession.findUnique({
      where: { id: sessionId },
      include: { socio: true },
    })
    return s?.socio?.nome || undefined
  } catch {
    return undefined
  }
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

type SocioBasic = {
  id: string
  nome: string
  matricula: string | null
  empresa: { nome: string; diaCorte: number } | null
}

/**
 * Busca sócios por CPF (11 dígitos) ou por matrícula.
 * Retorna array para permitir tratar múltiplos cadastros com o mesmo CPF.
 */
async function findSociosByIdentifier(input: string): Promise<SocioBasic[]> {
  const digits = onlyDigits(input)
  if (digits.length === 11) {
    // CPF — busca todas as matrículas ativas vinculadas
    const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
    return db.socio.findMany({
      where: { ativo: true, OR: [{ cpf: digits }, { cpf: formatted }] },
      select: { id: true, nome: true, matricula: true, empresa: { select: { nome: true, diaCorte: true } } },
      take: 10,
    })
  }
  // Matrícula
  const mat = input.trim()
  return db.socio.findMany({
    where: { ativo: true, matricula: mat },
    select: { id: true, nome: true, matricula: true, empresa: { select: { nome: true, diaCorte: true } } },
    take: 5,
  })
}

// ============================================================
// Consulta de margem — mesma lógica da página Nova Venda
// Tipo 3 ou 4 = cálculo local (limite - descontos do mês)
// Outros tipos = Zetra PHP, fallback para valor do banco
// ============================================================

function formatCpfZetra(cpf: string): string {
  const d = onlyDigits(cpf)
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function calcularMesReferenciaChatbot(diaCorte = 9): { mes: number; ano: number } {
  const hoje = new Date()
  if (hoje.getDate() > diaCorte) {
    // Próximo mês
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  }
  return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() }
}

async function consultarMargemSocio(socioId: string): Promise<{ margem: number; fonte: string } | null> {
  try {
    const socio = await db.socio.findFirst({
      where: { id: socioId },
      select: {
        id: true, matricula: true, cpf: true, tipo: true,
        limite: true, margemConsig: true,
        empresa: { select: { diaCorte: true } },
      },
    })
    if (!socio) return null

    // ── TIPO 3 ou 4: cálculo local ──────────────────────────
    if (socio.tipo === '3' || socio.tipo === '4') {
      const dc = calcularMesReferenciaChatbot(socio.empresa?.diaCorte ?? 9)
      const descontos = await db.parcela.aggregate({
        _sum: { valor: true },
        where: {
          venda: { socioId: socio.id, ativo: true, cancelado: false },
          OR: [{ baixa: '' }, { baixa: null }, { baixa: 'N' }],
          dataVencimento: {
            gte: new Date(dc.ano, dc.mes - 1, 1),
            lt: new Date(dc.ano, dc.mes, 1),
          },
        },
      })
      const margem = Number(socio.limite || 0) - Number(descontos._sum.valor || 0)
      return { margem, fonte: 'local' }
    }

    // ── Outros tipos: Zetra PHP ──────────────────────────────
    const matricula = socio.matricula || ''
    const cpf = formatCpfZetra(socio.cpf || '')
    if (!matricula || !cpf) {
      return { margem: Number(socio.margemConsig || 0), fonte: 'banco' }
    }

    const ZETRA_BASE_URL = process.env.ZETRA_BASE_URL || 'http://200.98.112.240/aspma/php/zetra_desktop'
    const params = new URLSearchParams({
      cliente: 'ASPMA', convenio: 'ASPMA-ARAUCARIA',
      usuario: 'aspma_xml', senha: 'dcc0bd05',
      matricula, cpf, valorParcela: '100.00',
    })
    const zetraUrl = `${ZETRA_BASE_URL}/consultaMargemZetra.php?${params}`

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(zetraUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: ctrl.signal,
    })
    clearTimeout(t)

    if (res.ok) {
      const xml = await res.text()

      // Verifica falha zetra
      const sucessoTag = xml.match(/<ns13:sucesso>([^<]*)<\/ns13:sucesso>/)
      if (sucessoTag?.[1] === 'false') {
        // Zetra retornou erro explícito — usa fallback
        return { margem: Number(socio.margemConsig || 0), fonte: 'fallback' }
      }

      const margemTag = xml.match(/<ns6:valorMargem[^>]*>([^<]+)<\/ns6:valorMargem>/)
      if (margemTag?.[1]) {
        const m = parseFloat(margemTag[1])
        if (!isNaN(m)) return { margem: m, fonte: 'zetra' }
      }
    }

    // Fallback para valor salvo no banco
    return { margem: Number(socio.margemConsig || 0), fonte: 'fallback' }
  } catch (e) {
    console.error('[chatbot] erro consultar margem:', e)
    return null
  }
}

function formatMargemReply(socioNome: string, margem: number, fonteLabel = ''): string {
  const linhas = [
    `Olá, *${socioNome.split(' ')[0]}*! Aqui estão seus dados:`,
    '',
    `💰 *Margem disponível:* ${brl(margem)}${fonteLabel}`,
    '',
    'O que deseja fazer agora?',
    '1) Simular crédito',
    '2) Falar com atendente',
    '3) Encerrar',
  ]
  return linhas.join('\n')
}

// ============================================================
// Descontos do sócio — agrupa parcelas em aberto por mês
// (mesma lógica da página /portal/desconto)
// ============================================================
const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type DescontoItem = { numero: number; totalParc: number; convenio: string; valor: number; venc: string }
type DescontoMes = {
  nomeSocio: string
  mesKey: number // YYYY*100 + MM
  mesLabel: string // ex: "Maio / 2026"
  total: number
  itens: DescontoItem[]
  outrosMeses: string[] // ex: ['05/2026', '06/2026']
  vazio: boolean
}

async function consultarDescontosSocio(socioId: string, mesKeyAlvo?: number): Promise<DescontoMes | null> {
  try {
    const tresAnosAtras = new Date()
    tresAnosAtras.setFullYear(tresAnosAtras.getFullYear() - 3)

    const socio = await db.socio.findFirst({
      where: { id: socioId },
      select: {
        nome: true,
        vendas: {
          where: { ativo: true, cancelado: false, dataEmissao: { gte: tresAnosAtras } },
          select: {
            id: true,
            numeroVenda: true,
            quantidadeParcelas: true,
            convenio: { select: { razao_soc: true } },
            parcelas: {
              select: { id: true, numeroParcela: true, dataVencimento: true, valor: true, baixa: true },
              orderBy: { numeroParcela: 'asc' },
            },
          },
        },
      },
    })
    if (!socio) return null

    // Agrupa parcelas em aberto por mês de vencimento
    const map = new Map<number, DescontoItem[]>()
    for (const venda of socio.vendas) {
      const conv = venda.convenio?.razao_soc || `Empréstimo #${venda.numeroVenda}`
      for (const p of venda.parcelas) {
        if (p.baixa === 'S') continue
        if (!p.dataVencimento) continue
        const d = new Date(p.dataVencimento)
        const key = d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1)
        const venc = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({
          numero: p.numeroParcela,
          totalParc: venda.quantidadeParcelas,
          convenio: conv,
          valor: Number(p.valor),
          venc,
        })
      }
    }

    const meses = [...map.keys()].sort((a, b) => a - b)
    if (meses.length === 0) {
      return { nomeSocio: socio.nome, mesKey: 0, mesLabel: '', total: 0, itens: [], outrosMeses: [], vazio: true }
    }

    // Determina mês alvo: o solicitado, ou o atual/próximo, ou o último
    let mesKey: number
    if (mesKeyAlvo && map.has(mesKeyAlvo)) {
      mesKey = mesKeyAlvo
    } else {
      const hoje = new Date()
      const keyHoje = hoje.getFullYear() * 100 + (hoje.getMonth() + 1)
      mesKey = meses.find((k) => k >= keyHoje) ?? meses[meses.length - 1]
    }

    const itens = (map.get(mesKey) || []).sort((a, b) => a.numero - b.numero)
    const total = itens.reduce((s, i) => s + i.valor, 0)
    const ano = Math.floor(mesKey / 100)
    const mes = mesKey % 100
    const mesLabel = `${MESES_NOMES[mes - 1]} / ${ano}`
    const outrosMeses = meses
      .filter((k) => k !== mesKey)
      .map((k) => `${String(k % 100).padStart(2, '0')}/${Math.floor(k / 100)}`)
      .slice(0, 6) // limita listagem

    return { nomeSocio: socio.nome, mesKey, mesLabel, total, itens, outrosMeses, vazio: false }
  } catch (e) {
    console.error('[chatbot] erro consultar descontos:', e)
    return null
  }
}

function parseMesAnoInput(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (!m) return null
  const mes = parseInt(m[1], 10)
  const ano = parseInt(m[2], 10)
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null
  return ano * 100 + mes
}

async function entregarDescontos(
  sessionId: string,
  socioId: string,
  socioNome: string,
  mesKeyAlvo?: number
): Promise<{ reply: string }> {
  const dados = await consultarDescontosSocio(socioId, mesKeyAlvo)
  if (!dados) {
    return { reply: 'Não consegui consultar seus descontos agora. Tente novamente em instantes.' }
  }
  if (dados.vazio) {
    return { reply: MSG.descontosVazio(socioNome) }
  }
  return {
    reply: MSG.descontosMes({
      nome: socioNome,
      mesLabel: dados.mesLabel,
      total: dados.total,
      itens: dados.itens,
      outrosMeses: dados.outrosMeses,
    }),
  }
}

// ============================================================
// 2ª via — comprovantes de pagamento e espelho de contrato
// ============================================================

function fmtDateBR(d: Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
}

type ParcelaPaga = {
  id: string
  vendaId: string
  convenio: string
  numero: number
  total: number
  valor: number
  valorPago: number
  dataVencimento: Date
  dataBaixa: Date
}

async function listarParcelasPagas(socioId: string, take = 5): Promise<ParcelaPaga[]> {
  const rows = await db.parcela.findMany({
    where: {
      baixa: 'S',
      venda: { socioId, ativo: true, cancelado: false },
    },
    orderBy: { dataBaixa: 'desc' },
    take,
    select: {
      id: true,
      numeroParcela: true,
      valor: true,
      valorPago: true,
      dataVencimento: true,
      dataBaixa: true,
      venda: {
        select: {
          id: true,
          numeroVenda: true,
          quantidadeParcelas: true,
          convenio: { select: { razao_soc: true } },
        },
      },
    },
  })
  return rows
    .filter((r) => r.dataBaixa)
    .map((r) => ({
      id: r.id,
      vendaId: r.venda.id,
      convenio: r.venda.convenio?.razao_soc || `Empréstimo #${r.venda.numeroVenda}`,
      numero: r.numeroParcela,
      total: r.venda.quantidadeParcelas,
      valor: Number(r.valor),
      valorPago: Number(r.valorPago || r.valor),
      dataVencimento: r.dataVencimento,
      dataBaixa: r.dataBaixa as Date,
    }))
}

type ContratoAtivo = {
  id: string
  numeroVenda: number
  convenio: string
  qtd: number
  valorParcela: number
  valorTotal: number
  dataEmissao: Date
  pagas: number
  proximas: Array<{ numero: number; dataVenc: Date; valor: number }>
}

async function listarContratosAtivos(socioId: string, take = 5): Promise<ContratoAtivo[]> {
  const tresAnosAtras = new Date()
  tresAnosAtras.setFullYear(tresAnosAtras.getFullYear() - 3)
  const vendas = await db.venda.findMany({
    where: { socioId, ativo: true, cancelado: false, dataEmissao: { gte: tresAnosAtras } },
    orderBy: { dataEmissao: 'desc' },
    take,
    select: {
      id: true,
      numeroVenda: true,
      dataEmissao: true,
      quantidadeParcelas: true,
      valorParcela: true,
      valorTotal: true,
      convenio: { select: { razao_soc: true } },
      parcelas: {
        select: { numeroParcela: true, dataVencimento: true, valor: true, baixa: true },
        orderBy: { numeroParcela: 'asc' },
      },
    },
  })
  return vendas.map((v) => {
    const pagas = v.parcelas.filter((p) => p.baixa === 'S').length
    const proximas = v.parcelas
      .filter((p) => p.baixa !== 'S')
      .slice(0, 3)
      .map((p) => ({ numero: p.numeroParcela, dataVenc: p.dataVencimento, valor: Number(p.valor) }))
    return {
      id: v.id,
      numeroVenda: v.numeroVenda,
      convenio: v.convenio?.razao_soc || `Empréstimo #${v.numeroVenda}`,
      qtd: v.quantidadeParcelas,
      valorParcela: Number(v.valorParcela),
      valorTotal: Number(v.valorTotal),
      dataEmissao: v.dataEmissao,
      pagas,
      proximas,
    }
  })
}

/**
 * Inicia o submenu de 2ª via.
 * Salva o tipo do submenu em cpfHash usando a tag "2VIA:menu".
 */
async function iniciar2Via(sessionId: string): Promise<{ reply: string }> {
  await setState(sessionId, { state: 'AWAITING_2VIA_TIPO', cpfHash: '2VIA:menu' })
  return { reply: MSG.segundaViaTipos() }
}

/**
 * Após o sócio escolher o tipo no submenu, lista os itens disponíveis.
 * O ID dos candidatos é salvo em cpfHash como "2VIA:pagas:id1,id2,..." ou "2VIA:contratos:id1,id2,...".
 */
async function entregarSubmenu2Via(
  sessionId: string,
  socioId: string,
  tipo: 'pagas' | 'contratos' | 'demonstrativo',
  socioNome: string
): Promise<{ reply: string; nextState: string }> {
  if (tipo === 'demonstrativo') {
    const r = await entregarDescontos(sessionId, socioId, socioNome)
    await setState(sessionId, { state: 'ANSWERED', lastIntent: 'DESCONTOS', cpfHash: null })
    return { reply: r.reply, nextState: 'ANSWERED' }
  }

  if (tipo === 'pagas') {
    const itens = await listarParcelasPagas(socioId, 5)
    if (itens.length === 0) {
      await setState(sessionId, { state: 'ANSWERED', lastIntent: 'SEGUNDA_VIA', cpfHash: null })
      return { reply: MSG.comprovantePagamentoVazio(), nextState: 'ANSWERED' }
    }
    const ids = itens.map((i) => i.id).join(',')
    await setState(sessionId, { state: 'AWAITING_2VIA_ITEM', cpfHash: `2VIA:pagas:${ids}`, lastIntent: 'SEGUNDA_VIA' })
    return {
      reply: MSG.comprovantePagamentoLista(
        itens.map((it, idx) => ({
          idx: idx + 1,
          convenio: it.convenio,
          numero: it.numero,
          total: it.total,
          valorPago: it.valorPago,
          dataBaixa: fmtDateBR(it.dataBaixa),
        }))
      ),
      nextState: 'AWAITING_2VIA_ITEM',
    }
  }

  // contratos
  const itens = await listarContratosAtivos(socioId, 5)
  if (itens.length === 0) {
    await setState(sessionId, { state: 'ANSWERED', lastIntent: 'SEGUNDA_VIA', cpfHash: null })
    return { reply: MSG.contratosVazio(), nextState: 'ANSWERED' }
  }
  const ids = itens.map((i) => i.id).join(',')
  await setState(sessionId, { state: 'AWAITING_2VIA_ITEM', cpfHash: `2VIA:contratos:${ids}`, lastIntent: 'SEGUNDA_VIA' })
  return {
    reply: MSG.contratosLista(
      itens.map((it, idx) => ({
        idx: idx + 1,
        convenio: it.convenio,
        numeroVenda: it.numeroVenda,
        qtd: it.qtd,
        valorParcela: it.valorParcela,
        valorTotal: it.valorTotal,
        dataEmissao: fmtDateBR(it.dataEmissao),
        pagas: it.pagas,
      }))
    ),
    nextState: 'AWAITING_2VIA_ITEM',
  }
}


export async function processMessage(input: ProcessInput): Promise<ProcessResult> {
  const text = (input.text || '').trim()
  if (!text) return { reply: null, nextState: 'NEW', handoff: false, ignored: true }

  const session = await getOrCreateSession(input.phone)
  const intent = detectIntent(text)

  // Para estados guiados (coleta de CPF, escolha de matrícula, data, OTP) usa o estado como tag de intent
  const guidedStates = ['AWAITING_CPF', 'AWAITING_MATRICULA_CHOICE', 'AWAITING_BIRTHDATE', 'OTP_SENT', 'AWAITING_2VIA_TIPO', 'AWAITING_2VIA_ITEM']
  const logIntent = guidedStates.includes(session.state) ? session.state : intent

  // Idempotência: se já registramos esse provider_message_id, não responde de novo
  const isNew = await logIncoming(session.id, input.providerMessageId, input.provider || 'whatsgw', text, logIntent)
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
  if (intent === 'MENU' && !guidedStates.includes(session.state)) {
    await setState(session.id, { state: 'AWAITING_INTENT' })
    const nome = await getSessionSocioName(session.id)
    const reply = MSG.saudacao(nome)
    await logOutgoing(session.id, reply, 'MENU')
    return { reply, nextState: 'AWAITING_INTENT', handoff: false, menu: true }
  }

  // Saudação simples (oi, bom dia, etc.) — não-bloqueia fluxos guiados
  if (intent === 'SAUDACAO' && !guidedStates.includes(session.state)) {
    await setState(session.id, { state: 'AWAITING_INTENT' })
    const nome = await getSessionSocioName(session.id)
    const reply = MSG.saudacao(nome)
    await logOutgoing(session.id, reply, 'SAUDACAO')
    return { reply, nextState: 'AWAITING_INTENT', handoff: false, menu: true }
  }

  // Agradecimento (obrigado, valeu, etc.)
  if (intent === 'AGRADECIMENTO' && !guidedStates.includes(session.state)) {
    const reply = MSG.agradecer()
    await logOutgoing(session.id, reply, 'AGRADECIMENTO')
    return { reply, nextState: session.state, handoff: false }
  }

  switch (session.state) {
    case 'NEW':
    case 'AWAITING_INTENT':
    case 'CLOSED':
    case 'HANDOFF': {
      if (intent === 'MARGEM') {
        // Se já autenticado nesta sessão, pula direto
        if (session.socioId && session.authLevel === 'L2') {
          const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
          const socio = fresh?.socio
          if (socio) {
            const margem = await consultarMargemSocio(socio.id)
            if (margem) {
              const fonteLabel = margem.fonte === 'fallback' ? ' _(estimado)_' : margem.fonte === 'banco' ? ' _(salvo)_' : ''
              const reply = formatMargemReply(socio.nome || 'sócio', margem.margem, fonteLabel)
              await setState(session.id, { state: 'ANSWERED', lastIntent: 'MARGEM' })
              await logOutgoing(session.id, reply, 'MARGEM')
              return { reply, nextState: 'ANSWERED', handoff: false }
            }
          }
        }
        await setState(session.id, { state: 'AWAITING_CPF', lastIntent: 'MARGEM' })
        const reply = MSG.pedirCpfOuMatricula()
        await logOutgoing(session.id, reply, 'MARGEM')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      if (intent === 'DESCONTOS') {
        // Se já autenticado, atende direto
        if (session.socioId && session.authLevel === 'L2') {
          const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
          const socio = fresh?.socio
          if (socio) {
            const { reply } = await entregarDescontos(session.id, socio.id, socio.nome || 'sócio')
            await setState(session.id, { state: 'ANSWERED', lastIntent: 'DESCONTOS' })
            await logOutgoing(session.id, reply, 'DESCONTOS')
            return { reply, nextState: 'ANSWERED', handoff: false }
          }
        }
        await setState(session.id, { state: 'AWAITING_CPF', lastIntent: 'DESCONTOS' })
        const reply = MSG.pedirCpfOuMatricula()
        await logOutgoing(session.id, reply, 'DESCONTOS')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      if (intent === 'SEGUNDA_VIA') {
        // Se já autenticado, mostra submenu direto
        if (session.socioId && session.authLevel === 'L2') {
          const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
          const socio = fresh?.socio
          if (socio) {
            const { reply } = await iniciar2Via(session.id)
            await setState(session.id, { lastIntent: 'SEGUNDA_VIA' })
            await logOutgoing(session.id, reply, 'SEGUNDA_VIA')
            return { reply, nextState: 'AWAITING_2VIA_TIPO', handoff: false }
          }
        }
        await setState(session.id, { state: 'AWAITING_CPF', lastIntent: 'SEGUNDA_VIA' })
        const reply = MSG.pedirCpfOuMatricula()
        await logOutgoing(session.id, reply, 'SEGUNDA_VIA')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      if (intent === 'STATUS_PROPOSTA' || intent === 'HORARIO') {
        await openHandoff(session.id, `INTENT_${intent}`)
        const reply = MSG.emConstrucao(
          intent === 'STATUS_PROPOSTA' ? 'Status da proposta' : 'Horário/atendimento'
        ) + '\n\n' + MSG.handoff()
        await logOutgoing(session.id, reply, intent)
        return { reply, nextState: 'HANDOFF', handoff: true }
      }
      if (intent === 'SIMULAR') {
        const reply = MSG.emConstrucao('Simulação de crédito') + '\n\n_Digite *menu* para outras opções._'
        await setState(session.id, { state: 'AWAITING_INTENT' })
        await logOutgoing(session.id, reply, 'SIMULAR')
        return { reply, nextState: 'AWAITING_INTENT', handoff: false }
      }
      // Sem intenção clara — mensagem nova: saudação; senão tenta LLM (Groq) como fallback inteligente
      if (session.state === 'NEW') {
        const nome = await getSessionSocioName(session.id)
        const reply = MSG.saudacao(nome)
        await setState(session.id, { state: 'AWAITING_INTENT' })
        await logOutgoing(session.id, reply, intent)
        return { reply, nextState: 'AWAITING_INTENT', handoff: false, menu: true }
      }
      const history = await recentHistory(session.id, 6)
      const aiReply = await groqChat(text, history)
      const reply = aiReply || MSG.fallback()
      await setState(session.id, { state: 'AWAITING_INTENT' })
      await logOutgoing(session.id, reply, aiReply ? 'LLM_FALLBACK' : intent)
      return { reply, nextState: 'AWAITING_INTENT', handoff: false }
    }

    case 'AWAITING_CPF': {
      const digits = onlyDigits(text)
      const isCpf = digits.length === 11

      // Valida dígito verificador somente quando parece CPF
      if (isCpf && !isValidCpf(text)) {
        const reply = MSG.cpfInvalido()
        await logOutgoing(session.id, reply, 'AWAITING_CPF')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      // Entrada muito curta para ser matrícula
      if (!isCpf && text.trim().length < 3) {
        const reply = MSG.pedirCpfOuMatricula()
        await logOutgoing(session.id, reply, 'AWAITING_CPF')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }

      const socios = await findSociosByIdentifier(text)

      if (socios.length === 0) {
        const reply = isCpf ? MSG.cpfNaoEncontrado() : MSG.matriculaNaoEncontrada()
        await logOutgoing(session.id, reply, 'AWAITING_CPF')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }

      if (socios.length > 1) {
        // Múltiplas matrículas para o mesmo CPF — pede escolha
        const candidates = socios.map((s) => s.id).join(',')
        await setState(session.id, { cpfHash: `CANDIDATES:${candidates}`, state: 'AWAITING_MATRICULA_CHOICE' })
        const reply = MSG.escolherMatricula(
          socios.map((s) => ({ matricula: s.matricula, nome: s.nome, empresa: s.empresa?.nome ?? null }))
        )
        await logOutgoing(session.id, reply, 'AWAITING_MATRICULA_CHOICE')
        return { reply, nextState: 'AWAITING_MATRICULA_CHOICE', handoff: false }
      }

      // Exatamente 1 resultado — avança para data de nascimento
      await setState(session.id, { socioId: socios[0].id, cpfHash: null, state: 'AWAITING_BIRTHDATE' })
      const reply = MSG.pedirNascimento()
      await logOutgoing(session.id, reply, 'AWAITING_CPF')
      return { reply, nextState: 'AWAITING_BIRTHDATE', handoff: false }
    }

    case 'AWAITING_MATRICULA_CHOICE': {
      // Recupera a lista de candidatos salva no campo cpfHash como "CANDIDATES:id1,id2,..."
      const fresh = await db.chatSession.findUnique({ where: { id: session.id } })
      const raw = fresh?.cpfHash || ''
      if (!raw.startsWith('CANDIDATES:')) {
        // Estado inválido — reinicia coleta
        await setState(session.id, { state: 'AWAITING_CPF', cpfHash: null })
        const reply = MSG.pedirCpfOuMatricula()
        await logOutgoing(session.id, reply, 'AWAITING_MATRICULA_CHOICE')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      const candidates = raw.replace('CANDIDATES:', '').split(',').filter(Boolean)
      const choice = parseInt(text.trim(), 10)
      if (isNaN(choice) || choice < 1 || choice > candidates.length) {
        const reply = `Por favor, responda com um número entre *1* e *${candidates.length}*.`
        await logOutgoing(session.id, reply, 'AWAITING_MATRICULA_CHOICE')
        return { reply, nextState: 'AWAITING_MATRICULA_CHOICE', handoff: false }
      }
      const chosenId = candidates[choice - 1]
      await setState(session.id, { socioId: chosenId, cpfHash: null, state: 'AWAITING_BIRTHDATE' })
      const reply = MSG.pedirNascimento()
      await logOutgoing(session.id, reply, 'AWAITING_MATRICULA_CHOICE')
      return { reply, nextState: 'AWAITING_BIRTHDATE', handoff: false }
    }

    case 'AWAITING_BIRTHDATE': {
      const dt = parseBirthDate(text)
      if (!dt) {
        const reply = MSG.nascimentoInvalido()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'AWAITING_BIRTHDATE', handoff: false }
      }
      // O socioId já foi definido na etapa AWAITING_CPF ou AWAITING_MATRICULA_CHOICE
      // Não precisamos mais recuperar CPF por hash — apenas carregamos o sócio vinculado
      const freshSession = await db.chatSession.findUnique({
        where: { id: session.id },
        include: { socio: true },
      })
      const socio = freshSession?.socio
      if (!socio) {
        // Sessão perdeu o vínculo — reinicia
        await setState(session.id, { state: 'AWAITING_CPF', cpfHash: null, socioId: null })
        const reply = MSG.pedirCpfOuMatricula()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'AWAITING_CPF', handoff: false }
      }
      if (!socio.dataNascimento) {
        console.warn(`[chatbot] AWAITING_BIRTHDATE: sócio ${socio.id} sem dataNascimento — não pode autenticar`)
        await openHandoff(session.id, 'AUTH_FAILED')
        const reply = MSG.socioNaoEncontrado()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'HANDOFF', handoff: true }
      }
      const dateMatch = sameDateUTC(socio.dataNascimento, dt)
      console.log(`[chatbot] AWAITING_BIRTHDATE: socioId=${socio.id} db=${socio.dataNascimento.toISOString()} input=${dt.toISOString()} match=${dateMatch}`)
      if (!dateMatch) {
        await openHandoff(session.id, 'AUTH_FAILED')
        const reply = MSG.socioNaoEncontrado()
        await logOutgoing(session.id, reply, 'AWAITING_BIRTHDATE')
        return { reply, nextState: 'HANDOFF', handoff: true }
      }

      // Autenticado — envia OTP (socioId já está vinculado na sessão)
      await setState(session.id, { state: 'OTP_SENT' })
      await createAndSendOtp(session.id, normalizePhoneE164BR(input.phone))
      const reply = MSG.otpEnviado()
      await logOutgoing(session.id, reply, 'OTP_SENT')
      return { reply, nextState: 'OTP_SENT', handoff: false }
    }

    case 'OTP_SENT': {
      const v = await verifyOtp(session.id, text)
      if (v.expired) {
        await setState(session.id, { state: 'AWAITING_CPF', cpfHash: null, socioId: null })
        const reply = MSG.otpExpirado() + '\n' + MSG.pedirCpfOuMatricula()
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

      // Autenticado → entrega conforme última intenção (MARGEM ou DESCONTOS)
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

      if (fresh?.lastIntent === 'DESCONTOS') {
        const { reply } = await entregarDescontos(session.id, socio.id, socio.nome || 'sócio')
        await setState(session.id, { state: 'ANSWERED', lastIntent: 'DESCONTOS' })
        await logOutgoing(session.id, reply, 'DESCONTOS')
        return { reply, nextState: 'ANSWERED', handoff: false }
      }

      if (fresh?.lastIntent === 'SEGUNDA_VIA') {
        const { reply } = await iniciar2Via(session.id)
        await logOutgoing(session.id, reply, 'SEGUNDA_VIA')
        return { reply, nextState: 'AWAITING_2VIA_TIPO', handoff: false }
      }

      // Default: margem
      const margem = await consultarMargemSocio(socio.id)
      if (!margem) {
        await openHandoff(session.id, 'MARGEM_API_FAIL')
        const reply = 'Não consegui consultar sua margem agora. Vou te transferir para um atendente.'
        await logOutgoing(session.id, reply, 'MARGEM')
        return { reply, nextState: 'HANDOFF', handoff: true }
      }
      const fonteLabel = margem.fonte === 'fallback' ? ' _(estimado)_' : margem.fonte === 'banco' ? ' _(salvo)_' : ''
      const reply = formatMargemReply(socio.nome || 'sócio', margem.margem, fonteLabel)
      await setState(session.id, { state: 'ANSWERED', lastIntent: 'MARGEM' })
      await logOutgoing(session.id, reply, 'MARGEM')
      return { reply, nextState: 'ANSWERED', handoff: false }
    }

    case 'ANSWERED': {
      // Reaproveita autenticação para atender outras intents sem novo OTP
      if (intent === 'MARGEM' && session.socioId && session.authLevel === 'L2') {
        const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
        const socio = fresh?.socio
        if (socio) {
          const margem = await consultarMargemSocio(socio.id)
          if (margem) {
            const fonteLabel = margem.fonte === 'fallback' ? ' _(estimado)_' : margem.fonte === 'banco' ? ' _(salvo)_' : ''
            const reply = formatMargemReply(socio.nome || 'sócio', margem.margem, fonteLabel)
            await setState(session.id, { state: 'ANSWERED', lastIntent: 'MARGEM' })
            await logOutgoing(session.id, reply, 'MARGEM')
            return { reply, nextState: 'ANSWERED', handoff: false }
          }
        }
      }
      if (intent === 'DESCONTOS' && session.socioId && session.authLevel === 'L2') {
        const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
        const socio = fresh?.socio
        if (socio) {
          const { reply } = await entregarDescontos(session.id, socio.id, socio.nome || 'sócio')
          await setState(session.id, { state: 'ANSWERED', lastIntent: 'DESCONTOS' })
          await logOutgoing(session.id, reply, 'DESCONTOS')
          return { reply, nextState: 'ANSWERED', handoff: false }
        }
      }
      if (intent === 'SEGUNDA_VIA' && session.socioId && session.authLevel === 'L2') {
        const { reply } = await iniciar2Via(session.id)
        await setState(session.id, { lastIntent: 'SEGUNDA_VIA' })
        await logOutgoing(session.id, reply, 'SEGUNDA_VIA')
        return { reply, nextState: 'AWAITING_2VIA_TIPO', handoff: false }
      }

      // Navegação por mês quando última resposta foi de DESCONTOS
      if (session.lastIntent === 'DESCONTOS' && session.socioId) {
        const mesKey = parseMesAnoInput(text)
        if (mesKey) {
          const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
          const socio = fresh?.socio
          if (socio) {
            const { reply } = await entregarDescontos(session.id, socio.id, socio.nome || 'sócio', mesKey)
            await logOutgoing(session.id, reply, 'DESCONTOS')
            return { reply, nextState: 'ANSWERED', handoff: false }
          }
        }
      }

      // Atalhos numéricos pós-resposta (mantém compatibilidade com o rodapé do formatMargemReply)
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

    case 'AWAITING_2VIA_TIPO': {
      // Sócio escolhe (1) comprovante pagamento, (2) espelho contrato, (3) demonstrativo
      const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
      const socio = fresh?.socio
      if (!socio) {
        await setState(session.id, { state: 'AWAITING_INTENT', cpfHash: null })
        const reply = MSG.fallback()
        await logOutgoing(session.id, reply, 'AWAITING_2VIA_TIPO')
        return { reply, nextState: 'AWAITING_INTENT', handoff: false }
      }
      const choice = parseInt(text.trim(), 10)
      const tipo: 'pagas' | 'contratos' | 'demonstrativo' | null =
        choice === 1 ? 'pagas' : choice === 2 ? 'contratos' : choice === 3 ? 'demonstrativo' : null
      if (!tipo) {
        const reply = 'Por favor, responda com *1*, *2* ou *3*.\n\n' + MSG.segundaViaTipos()
        await logOutgoing(session.id, reply, 'AWAITING_2VIA_TIPO')
        return { reply, nextState: 'AWAITING_2VIA_TIPO', handoff: false }
      }
      const r = await entregarSubmenu2Via(session.id, socio.id, tipo, socio.nome || 'sócio')
      await logOutgoing(session.id, r.reply, 'SEGUNDA_VIA')
      return { reply: r.reply, nextState: r.nextState, handoff: false }
    }

    case 'AWAITING_2VIA_ITEM': {
      // Sócio escolhe número do item listado (parcela paga ou contrato ativo)
      const fresh = await db.chatSession.findUnique({ where: { id: session.id }, include: { socio: true } })
      const socio = fresh?.socio
      const raw = fresh?.cpfHash || ''
      if (!socio || (!raw.startsWith('2VIA:pagas:') && !raw.startsWith('2VIA:contratos:'))) {
        await setState(session.id, { state: 'AWAITING_INTENT', cpfHash: null })
        const reply = MSG.fallback()
        await logOutgoing(session.id, reply, 'AWAITING_2VIA_ITEM')
        return { reply, nextState: 'AWAITING_INTENT', handoff: false }
      }
      const isPagas = raw.startsWith('2VIA:pagas:')
      const ids = raw.replace(isPagas ? '2VIA:pagas:' : '2VIA:contratos:', '').split(',').filter(Boolean)
      const choice = parseInt(text.trim(), 10)
      if (isNaN(choice) || choice < 1 || choice > ids.length) {
        const reply = `Por favor, responda com um número entre *1* e *${ids.length}*.`
        await logOutgoing(session.id, reply, 'AWAITING_2VIA_ITEM')
        return { reply, nextState: 'AWAITING_2VIA_ITEM', handoff: false }
      }
      const chosenId = ids[choice - 1]

      if (isPagas) {
        const p = await db.parcela.findUnique({
          where: { id: chosenId },
          select: {
            numeroParcela: true,
            valor: true,
            valorPago: true,
            dataVencimento: true,
            dataBaixa: true,
            venda: {
              select: {
                numeroVenda: true,
                quantidadeParcelas: true,
                convenio: { select: { razao_soc: true } },
              },
            },
          },
        })
        if (!p) {
          const reply = 'Item não encontrado. Digite *menu* para recomeçar.'
          await setState(session.id, { state: 'AWAITING_INTENT', cpfHash: null })
          await logOutgoing(session.id, reply, 'AWAITING_2VIA_ITEM')
          return { reply, nextState: 'AWAITING_INTENT', handoff: false }
        }
        const reply = MSG.comprovanteDetalhe({
          convenio: p.venda.convenio?.razao_soc || `Empréstimo #${p.venda.numeroVenda}`,
          numero: p.numeroParcela,
          total: p.venda.quantidadeParcelas,
          valor: Number(p.valor),
          valorPago: Number(p.valorPago || p.valor),
          dataVenc: fmtDateBR(p.dataVencimento),
          dataBaixa: fmtDateBR(p.dataBaixa),
        })
        await setState(session.id, { state: 'ANSWERED', lastIntent: 'SEGUNDA_VIA', cpfHash: null })
        await logOutgoing(session.id, reply, 'SEGUNDA_VIA')
        return { reply, nextState: 'ANSWERED', handoff: false }
      }

      // contratos
      const v = await db.venda.findUnique({
        where: { id: chosenId },
        select: {
          numeroVenda: true,
          dataEmissao: true,
          quantidadeParcelas: true,
          valorParcela: true,
          valorTotal: true,
          convenio: { select: { razao_soc: true } },
          parcelas: {
            select: { numeroParcela: true, dataVencimento: true, valor: true, baixa: true },
            orderBy: { numeroParcela: 'asc' },
          },
        },
      })
      if (!v) {
        const reply = 'Contrato não encontrado. Digite *menu* para recomeçar.'
        await setState(session.id, { state: 'AWAITING_INTENT', cpfHash: null })
        await logOutgoing(session.id, reply, 'AWAITING_2VIA_ITEM')
        return { reply, nextState: 'AWAITING_INTENT', handoff: false }
      }
      const pagas = v.parcelas.filter((p) => p.baixa === 'S').length
      const proximas = v.parcelas
        .filter((p) => p.baixa !== 'S')
        .slice(0, 5)
        .map((p) => ({ numero: p.numeroParcela, dataVenc: fmtDateBR(p.dataVencimento), valor: Number(p.valor) }))
      const reply = MSG.contratoEspelho({
        convenio: v.convenio?.razao_soc || `Empréstimo #${v.numeroVenda}`,
        numeroVenda: v.numeroVenda,
        dataEmissao: fmtDateBR(v.dataEmissao),
        qtd: v.quantidadeParcelas,
        valorParcela: Number(v.valorParcela),
        valorTotal: Number(v.valorTotal),
        pagas,
        proximas,
      })
      await setState(session.id, { state: 'ANSWERED', lastIntent: 'SEGUNDA_VIA', cpfHash: null })
      await logOutgoing(session.id, reply, 'SEGUNDA_VIA')
      return { reply, nextState: 'ANSWERED', handoff: false }
    }

    default: {
      await setState(session.id, { state: 'AWAITING_INTENT' })
      const reply = MSG.fallback()
      await logOutgoing(session.id, reply, intent)
      return { reply, nextState: 'AWAITING_INTENT', handoff: false }
    }
  }
}

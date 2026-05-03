/**
 * Detecta intenção da mensagem do sócio (regras + sinônimos + fuzzy).
 */
export type Intent =
  | 'MARGEM'
  | 'STATUS_PROPOSTA'
  | 'SEGUNDA_VIA'
  | 'HORARIO'
  | 'ATENDENTE'
  | 'MENU'
  | 'CANCELAR'
  | 'SAUDACAO'
  | 'AGRADECIMENTO'
  | 'SIMULAR'
  | 'UNKNOWN'

// Normaliza texto: minúsculo, remove acentos, comprime espaços
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Distância de Levenshtein simples
function lev(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + c)
    }
  }
  return dp[a.length][b.length]
}

// Verifica se algum token da mensagem é "próximo" (≤ tolerância) de alguma keyword
function fuzzyHit(text: string, keywords: string[]): boolean {
  // Match por substring direta (cobre frases multi-palavra)
  for (const kw of keywords) {
    if (kw.includes(' ')) {
      if (text.includes(kw)) return true
    }
  }
  const tokens = text.split(/\s+/).filter(Boolean)
  for (const tk of tokens) {
    for (const kw of keywords) {
      if (kw.includes(' ')) continue
      if (tk === kw) return true
      if (tk.length >= 4 && kw.length >= 4) {
        const tol = Math.max(1, Math.floor(kw.length / 5))
        if (lev(tk, kw) <= tol) return true
      }
    }
  }
  return false
}

// Dicionário de sinônimos por intent
const SYN: Record<Exclude<Intent, 'UNKNOWN'>, string[]> = {
  ATENDENTE: ['atendente', 'humano', 'pessoa', 'operador', 'consultor', 'gerente', 'funcionario', 'representante', 'falar com alguem'],
  CANCELAR: ['cancelar', 'sair', 'encerrar', 'parar', 'tchau', 'fim', 'ate logo', 'ate mais'],
  MENU: ['menu', 'opcoes', 'opcao', 'ajuda', 'help', 'comecar', 'inicio', 'voltar'],
  MARGEM: ['margem', 'saldo', 'disponivel', 'limite', 'consignavel', 'espaco', 'capacidade', 'quanto posso'],
  STATUS_PROPOSTA: ['proposta', 'propostas', 'status', 'andamento', 'venda', 'contrato', 'pedido', 'analise', 'aprovado', 'liberado'],
  SEGUNDA_VIA: ['boleto', 'comprovante', 'recibo', 'extrato', 'contracheque', 'holerite', 'demonstrativo', 'segunda via', '2a via', '2 via'],
  HORARIO: ['horario', 'atendimento', 'funcionamento', 'aberto', 'endereco', 'telefone', 'localizacao'],
  SAUDACAO: ['oi', 'ola', 'hello', 'hi', 'eai', 'opa', 'oie', 'salve', 'tudo bem', 'bom dia', 'boa tarde', 'boa noite'],
  AGRADECIMENTO: ['obrigado', 'obrigada', 'valeu', 'agradecido', 'agradecida', 'thanks', 'vlw', 'obg', 'grato', 'grata'],
  SIMULAR: ['simular', 'simulacao', 'calcular', 'calculo', 'parcela', 'emprestimo', 'credito'],
}

export function detectIntent(text: string): Intent {
  const t = norm(text)
  if (!t) return 'UNKNOWN'

  // Atalhos numéricos do menu (avaliar antes para evitar falsos positivos)
  if (/^1$/.test(t)) return 'MARGEM'
  if (/^2$/.test(t)) return 'STATUS_PROPOSTA'
  if (/^3$/.test(t)) return 'SEGUNDA_VIA'
  if (/^4$/.test(t)) return 'ATENDENTE'

  // Ordem de precedência (mais específicos primeiro)
  const order: Array<Exclude<Intent, 'UNKNOWN'>> = [
    'ATENDENTE',
    'CANCELAR',
    'MENU',
    'AGRADECIMENTO',
    'SIMULAR',
    'SEGUNDA_VIA',
    'STATUS_PROPOSTA',
    'MARGEM',
    'HORARIO',
    'SAUDACAO',
  ]

  for (const intent of order) {
    if (fuzzyHit(t, SYN[intent])) return intent
  }
  return 'UNKNOWN'
}

// Saudação contextual conforme horário (TZ Brasil)
export function greetingByHour(date: Date = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = Number(
    new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(date)
  )
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

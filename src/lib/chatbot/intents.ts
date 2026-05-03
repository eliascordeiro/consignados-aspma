/**
 * Detecta intenção da mensagem do sócio (regras simples por keyword).
 */
export type Intent =
  | 'MARGEM'
  | 'STATUS_PROPOSTA'
  | 'SEGUNDA_VIA'
  | 'HORARIO'
  | 'ATENDENTE'
  | 'MENU'
  | 'CANCELAR'
  | 'UNKNOWN'

const RX = {
  MARGEM: /\b(margem|saldo|disponi|limite|consign[áa]vel)\b/i,
  STATUS_PROPOSTA: /\b(propost|status|andament|venda|contrat)\b/i,
  SEGUNDA_VIA: /\b(2[ªa]?\s*via|segunda\s*via|boleto|comprovante|recibo)\b/i,
  HORARIO: /\b(hor[áa]rio|atendimento|funcionament|aberto|endere[çc]o)\b/i,
  ATENDENTE: /\b(atendente|humano|pessoa|falar com algu[ée]m|operador)\b/i,
  MENU: /\b(menu|op[çc][õo]es|ajuda|come[çc]ar|in[íi]cio)\b/i,
  CANCELAR: /\b(cancelar|sair|encerrar|parar)\b/i,
}

export function detectIntent(text: string): Intent {
  const t = (text || '').trim()
  if (!t) return 'UNKNOWN'
  if (RX.ATENDENTE.test(t)) return 'ATENDENTE'
  if (RX.CANCELAR.test(t)) return 'CANCELAR'
  if (RX.MENU.test(t)) return 'MENU'
  if (RX.MARGEM.test(t)) return 'MARGEM'
  if (RX.STATUS_PROPOSTA.test(t)) return 'STATUS_PROPOSTA'
  if (RX.SEGUNDA_VIA.test(t)) return 'SEGUNDA_VIA'
  if (RX.HORARIO.test(t)) return 'HORARIO'
  // Atalhos numéricos do menu
  if (/^\s*1\s*$/.test(t)) return 'MARGEM'
  if (/^\s*2\s*$/.test(t)) return 'STATUS_PROPOSTA'
  if (/^\s*3\s*$/.test(t)) return 'SEGUNDA_VIA'
  if (/^\s*4\s*$/.test(t)) return 'ATENDENTE'
  return 'UNKNOWN'
}

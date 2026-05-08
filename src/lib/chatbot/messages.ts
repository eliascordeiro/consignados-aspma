import { greetingByHour } from './intents'

// Número do atendimento humano da ASPMA (substitui o handoff interno)
const ATENDENTE_TEL_DISPLAY = '41 98831-8343'
const ATENDENTE_TEL_LINK = 'https://wa.me/5541988318343'

export const MSG = {
  saudacao: (nomeOpt?: string) => {
    const g = greetingByHour()
    const nome = nomeOpt ? `, *${nomeOpt.split(' ')[0]}*` : ''
    return [
      `${g}${nome}! 👋`,
      'Sou o assistente virtual da *ASPMA Consignados*.',
      '',
      'Toque no botão abaixo e escolha como posso te ajudar.',
    ].join('\n')
  },
  pedirCpf: () => 'Para consultar seus dados, informe seu *CPF* (apenas números) ou sua *matrícula*.',
  pedirCpfOuMatricula: () =>
    'Para consultar seus dados, informe seu *CPF* (11 dígitos) ou sua *matrícula*.',
  cpfInvalido: () => 'CPF inválido. ❌ Por favor, verifique os dígitos ou informe sua *matrícula*.',
  cpfNaoEncontrado: () =>
    'CPF não encontrado em nosso sistema. 🔎\nVerifique os dados ou tente sua *matrícula*.',
  matriculaNaoEncontrada: () =>
    'Matrícula não encontrada. 🔎\nVerifique o número ou informe seu *CPF* (11 dígitos).',
  pedirNascimento: () => 'Agora informe sua *data de nascimento*.\nFormatos aceitos: *DD/MM/AAAA* ou *DDMMAAAA* (ex: 15/08/1985 ou 15081985).',
  nascimentoInvalido: () => 'Data inválida. ❌ Use *DD/MM/AAAA* ou *DDMMAAAA* (ex: 15/08/1985 ou 15081985).',
  escolherMatricula: (_socios: Array<{ matricula: string | null; nome: string; empresa: string | null }>) => {
    return '📋 Encontrei mais de um cadastro para este CPF.\nToque no botão abaixo e escolha sua matrícula.'
  },
  socioNaoEncontrado: () =>
    `Não localizei seu cadastro com esses dados. 🔎
Para atendimento humano, fale com um atendente da ASPMA:
${ATENDENTE_TEL_LINK}`,
  otpEnviado: () =>
    'Enviei um *código de 6 dígitos* 🔐\nDigite-o aqui para concluir a verificação. _(Validade de 5 minutos)_',
  otpInvalido: (restantes: number) =>
    `Código inválido. ❌ Você ainda tem *${restantes}* tentativa(s).`,
  otpExpirado: () => 'Código expirado. ⏱️ Vamos recomeçar.',
  bloqueado: () =>
    `Muitas tentativas. 🛑 Por segurança, encerrei esta verificação.
Fale com um atendente da ASPMA:
${ATENDENTE_TEL_LINK}`,
  handoff: () =>
    `Para falar com um atendente: 🙋\n${ATENDENTE_TEL_LINK}`,
  encerrar: () => 'Atendimento encerrado. Sempre que precisar, é só chamar! 👋',
  fallback: () =>
    [
      'Não entendi sua mensagem. 🤔',
      '',
      'Toque no botão abaixo para ver as opções disponíveis.',
    ].join('\n'),
  emConstrucao: (assunto: string) =>
    `O atendimento de "${assunto}" estará disponível em breve. ⚙️
Para falar com um atendente agora:
${ATENDENTE_TEL_LINK}`,
  agradecer: () => 'Por nada! 😊 Posso te ajudar em mais alguma coisa? Digite *menu* para ver as opções.',
  descontosVazio: (nomeOpt?: string, margem?: number | null, fonteLabel = '') => {
    const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    const primeiroNome = nomeOpt ? nomeOpt.split(' ')[0] : ''
    const linhas: string[] = []
    if (typeof margem === 'number') {
      linhas.push(`💰 *Margem disponível:* ${brl(margem)}${fonteLabel}`)
      linhas.push('━━━━━━━━━━━━━━━━━━')
    }
    if (primeiroNome) {
      linhas.push(`👤 Olá, *${primeiroNome}*!`)
      linhas.push('')
    }
    linhas.push('🎉 Você está em dia — *nenhum desconto pendente* foi encontrado.')
    linhas.push('')
    linhas.push('📅 Para consultar outro mês, digite no formato *MM/AAAA* (ex: _04/2026_) ou toque no botão abaixo.')
    linhas.push('')
    linhas.push(`Dúvidas? Fale com um atendente: ${ATENDENTE_TEL_LINK}`)
    return linhas.join('\n')
  },
  descontosMes: (args: {
    nome: string
    mesLabel: string
    total: number
    itens: Array<{ numero: number; totalParc: number; convenio: string; valor: number; venc: string }>
    outrosMeses: string[] // ex: ['05/2026', '06/2026', ...]
    margem?: number | null
    fonteMargemLabel?: string
  }) => {
    const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    const linhas: string[] = []
    // Header: margem disponível sempre em destaque
    if (typeof args.margem === 'number') {
      linhas.push(`💰 *Margem disponível:* ${brl(args.margem)}${args.fonteMargemLabel || ''}`)
      linhas.push('━━━━━━━━━━━━━━━━━━')
    }
    linhas.push(`👤 *${args.nome.split(' ')[0]}* · ${args.mesLabel}`)
    linhas.push('')
    linhas.push(`🗒️ *Descontos do mês:* ${brl(args.total)}`)
    linhas.push(`📄 ${args.itens.length} parcela${args.itens.length !== 1 ? 's' : ''} pendente${args.itens.length !== 1 ? 's' : ''}`)
    linhas.push('')
    for (const it of args.itens) {
      linhas.push(`• *${it.numero}/${it.totalParc}* — ${it.convenio}`)
      linhas.push(`   ${brl(it.valor)} · venc. ${it.venc}`)
    }
    linhas.push('')
    linhas.push('📅 _Para outro mês, toque no botão ou digite *MM/AAAA* (ex: 04/2026)._')
    linhas.push('👇 Toque no botão abaixo para mais opções.')
    return linhas.join('\n')
  },
  escolherMes: (_meses: Array<{ label: string }>) => {
    return '📅 Toque no botão abaixo e escolha o mês desejado para ver seus descontos.'
  },
}

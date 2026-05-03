import { greetingByHour } from './intents'

// Número do atendimento humano da ASPMA (substitui o handoff interno)
const ATENDENTE_TEL_DISPLAY = '41 98831-8343'
const ATENDENTE_TEL_LINK = 'https://wa.me/5541988318343'

export const MSG = {
  saudacao: (nomeOpt?: string) => {
    const g = greetingByHour()
    const nome = nomeOpt ? `, ${nomeOpt.split(' ')[0]}` : ''
    return [
      `${g}${nome}! 👋 Sou o assistente virtual da *ASPMA Consignados*.`,
      'Posso te ajudar com:',
      '',
      '*1)* 💰 Margem disponível',
      '*2)* 🗒️ Descontos do mês',
      '*3)* 🙋 Falar com atendente',
      '',
      '_Digite o número da opção ou descreva sua dúvida._',
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
  escolherMatricula: (socios: Array<{ matricula: string | null; nome: string; empresa: string | null }>) => {
    const linhas = [
      'Encontrei mais de um cadastro para este CPF. 📋',
      'Escolha o número correspondente à sua matrícula:',
      '',
    ]
    socios.forEach((s, i) => {
      const emp = s.empresa ? ` — ${s.empresa}` : ''
      const mat = s.matricula || '(sem matrícula)'
      linhas.push(`*${i + 1})* Mat. ${mat}${emp}`)
    })
    return linhas.join('\n')
  },
  socioNaoEncontrado: () =>
    `Não localizei seu cadastro com esses dados. 🔎
Para atendimento humano, fale com um atendente da ASPMA pelo *${ATENDENTE_TEL_DISPLAY}*.
${ATENDENTE_TEL_LINK}`,
  otpEnviado: () =>
    'Enviei um *código de 6 dígitos* 🔐\nDigite-o aqui para concluir a verificação. _(Validade de 5 minutos)_',
  otpInvalido: (restantes: number) =>
    `Código inválido. ❌ Você ainda tem *${restantes}* tentativa(s).`,
  otpExpirado: () => 'Código expirado. ⏱️ Vamos recomeçar.',
  bloqueado: () =>
    `Muitas tentativas. 🛑 Por segurança, encerrei esta verificação.
Fale com um atendente da ASPMA pelo *${ATENDENTE_TEL_DISPLAY}*.
${ATENDENTE_TEL_LINK}`,
  handoff: () =>
    `Para falar com um atendente, chame pelo *${ATENDENTE_TEL_DISPLAY}* — é o número onde os humanos da ASPMA atendem. 🙋
${ATENDENTE_TEL_LINK}`,
  encerrar: () => 'Atendimento encerrado. Sempre que precisar, é só chamar! 👋',
  fallback: () =>
    [
      'Não entendi sua mensagem. 🤔',
      '',
      'Posso te ajudar com:',
      '*1)* Margem disponível',
      '*2)* Descontos do mês',
      `*3)* Falar com atendente (*${ATENDENTE_TEL_DISPLAY}*)`,
    ].join('\n'),
  emConstrucao: (assunto: string) =>
    `O atendimento de "${assunto}" estará disponível em breve. ⚙️
Para falar com um atendente agora, ligue ou chame no *${ATENDENTE_TEL_DISPLAY}*.
${ATENDENTE_TEL_LINK}`,
  agradecer: () => 'Por nada! 😊 Posso te ajudar em mais alguma coisa? Digite *menu* para ver as opções.',
  descontosVazio: (nomeOpt?: string) => {
    const nome = nomeOpt ? `, *${nomeOpt.split(' ')[0]}*` : ''
    return `✅ Tudo em dia${nome}! Não há parcelas pendentes no momento.`
  },
  descontosMes: (args: {
    nome: string
    mesLabel: string
    total: number
    itens: Array<{ numero: number; totalParc: number; convenio: string; valor: number; venc: string }>
    outrosMeses: string[] // ex: ['05/2026', '06/2026', ...]
  }) => {
    const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    const linhas: string[] = [
      `🗒️ *Descontos – ${args.mesLabel}*`,
      `👤 ${args.nome.split(' ')[0]}`,
      '',
      `💰 *Total do mês:* ${brl(args.total)}`,
      `📄 ${args.itens.length} parcela${args.itens.length !== 1 ? 's' : ''}`,
      '',
    ]
    for (const it of args.itens) {
      linhas.push(`• *${it.numero}/${it.totalParc}* — ${it.convenio}`)
      linhas.push(`   ${brl(it.valor)} · venc. ${it.venc}`)
    }
    if (args.outrosMeses.length > 0) {
      linhas.push('')
      linhas.push('_Para ver outro mês, digite no formato MM/AAAA._')
      linhas.push(`_Disponíveis: ${args.outrosMeses.join(', ')}_`)
    }
    linhas.push('')
    linhas.push('_Digite *menu* para outras opções._')
    return linhas.join('\n')
  },
}

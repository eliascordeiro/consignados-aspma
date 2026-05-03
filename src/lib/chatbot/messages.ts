import { greetingByHour } from './intents'

export const MSG = {
  saudacao: (nomeOpt?: string) => {
    const g = greetingByHour()
    const nome = nomeOpt ? `, ${nomeOpt.split(' ')[0]}` : ''
    return [
      `${g}${nome}! 👋 Sou o assistente virtual da *ASPMA Consignados*.`,
      'Posso te ajudar com:',
      '',
      '*1)* 💰 Margem disponível',
      '*2)* 📋 Status da proposta',
      '*3)* 📄 2ª via / comprovante',
      '*4)* 🙋 Falar com um atendente',
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
    'Não localizei seu cadastro com esses dados. 🔎\nVou te transferir para um atendente.',
  otpEnviado: () =>
    'Enviei um *código de 6 dígitos* 🔐\nDigite-o aqui para concluir a verificação. _(Validade de 5 minutos)_',
  otpInvalido: (restantes: number) =>
    `Código inválido. ❌ Você ainda tem *${restantes}* tentativa(s).`,
  otpExpirado: () => 'Código expirado. ⏱️ Vamos recomeçar.',
  bloqueado: () =>
    'Muitas tentativas. 🛑 Por segurança, vou transferir para um atendente.',
  handoff: () =>
    'Tudo bem, vou transferir você para um atendente. 🙋\nEm instantes alguém da equipe entra em contato.',
  encerrar: () => 'Atendimento encerrado. Sempre que precisar, é só chamar! 👋',
  fallback: () =>
    [
      'Não entendi sua mensagem. 🤔',
      '',
      'Posso te ajudar com:',
      '*1)* Margem disponível',
      '*2)* Status da proposta',
      '*3)* 2ª via',
      '*4)* Falar com atendente',
    ].join('\n'),
  emConstrucao: (assunto: string) =>
    `O atendimento de "${assunto}" estará disponível em breve. ⚙️\nPosso te transferir para um atendente?`,
  agradecer: () => 'Por nada! 😊 Posso te ajudar em mais alguma coisa? Digite *menu* para ver as opções.',
}

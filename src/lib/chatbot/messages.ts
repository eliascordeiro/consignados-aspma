export const MSG = {
  saudacao: () =>
    [
      'Olá! Sou o assistente virtual da ASPMA Consignados.',
      'Posso te ajudar com:',
      '1) Margem disponível',
      '2) Status da proposta',
      '3) 2ª via / comprovante',
      '4) Falar com um atendente',
      '',
      'Digite o número ou descreva sua dúvida.',
    ].join('\n'),
  pedirCpf: () => 'Para consultar seus dados, informe seu *CPF* (apenas números).',
  cpfInvalido: () => 'CPF inválido. Por favor, digite novamente apenas os números.',
  pedirNascimento: () =>
    'Agora informe sua *data de nascimento* no formato DD/MM/AAAA.',
  nascimentoInvalido: () => 'Data inválida. Use o formato DD/MM/AAAA.',
  socioNaoEncontrado: () =>
    'Não localizei seu cadastro com esses dados. Vou te transferir para um atendente.',
  otpEnviado: () =>
    'Enviei um *código de 6 dígitos*. Digite-o aqui para concluir a verificação. (Validade de 5 minutos)',
  otpInvalido: (restantes: number) =>
    `Código inválido. Você ainda tem ${restantes} tentativa(s).`,
  otpExpirado: () => 'Código expirado. Vamos recomeçar.',
  bloqueado: () =>
    'Muitas tentativas. Por segurança, vou transferir para um atendente.',
  handoff: () =>
    'Tudo bem, vou transferir você para um atendente. Em instantes alguém da equipe entra em contato.',
  encerrar: () =>
    'Atendimento encerrado. Sempre que precisar, é só chamar. 👋',
  fallback: () =>
    [
      'Não entendi sua mensagem. Posso te ajudar com:',
      '1) Margem disponível',
      '2) Status da proposta',
      '3) 2ª via',
      '4) Falar com atendente',
    ].join('\n'),
  emConstrucao: (assunto: string) =>
    `O atendimento de "${assunto}" estará disponível em breve. Posso te transferir para um atendente?`,
}

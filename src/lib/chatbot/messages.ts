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
      '*2)* �️ Descontos do mês',
      '*3)* 📋 Status da proposta',
      '*4)* 📄 2ª via / comprovante',
      '*5)* 🙋 Falar com um atendente',
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
      '*2)* Descontos do mês',
      '*3)* Status da proposta',
      '*4)* 2ª via',
      '*5)* Falar com atendente',
    ].join('\n'),
  emConstrucao: (assunto: string) =>
    `O atendimento de "${assunto}" estará disponível em breve. ⚙️\nPosso te transferir para um atendente?`,
  agradecer: () => 'Por nada! 😊 Posso te ajudar em mais alguma coisa? Digite *menu* para ver as opções.',
  segundaViaTipos: () =>
    [
      '📄 *2ª via — o que você precisa?*',
      '',
      '*1)* ✅ Comprovante de pagamento (parcela quitada)',
      '*2)* 📋 Espelho do contrato (resumo do empréstimo)',
      '*3)* 🗒️ Demonstrativo do mês',
      '',
      '_Digite o número da opção desejada._',
    ].join('\n'),
  comprovantePagamentoVazio: () =>
    'Você ainda não possui parcelas quitadas registradas. ✅',
  comprovantePagamentoLista: (itens: Array<{ idx: number; convenio: string; numero: number; total: number; valorPago: number; dataBaixa: string }>) => {
    const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    const linhas = ['✅ *Últimas parcelas pagas:*', '']
    for (const it of itens) {
      linhas.push(`*${it.idx})* ${it.convenio}`)
      linhas.push(`   Parcela ${it.numero}/${it.total} · pago ${it.dataBaixa} · ${brl(it.valorPago)}`)
    }
    linhas.push('')
    linhas.push('_Digite o número para ver o detalhe da parcela._')
    linhas.push('_Para o PDF do comprovante, fale com um atendente (digite *atendente*)._')
    return linhas.join('\n')
  },
  comprovanteDetalhe: (item: { convenio: string; numero: number; total: number; valor: number; valorPago: number; dataVenc: string; dataBaixa: string }) => {
    const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    return [
      '✅ *Comprovante de pagamento*',
      '',
      `📌 Convênio: *${item.convenio}*`,
      `🔢 Parcela: *${item.numero}/${item.total}*`,
      `💰 Valor: ${brl(item.valor)}`,
      `💵 Valor pago: ${brl(item.valorPago)}`,
      `📅 Vencimento: ${item.dataVenc}`,
      `✔️ Data do pagamento: ${item.dataBaixa}`,
      '',
      '_Para receber o comprovante em PDF, digite *atendente*._',
      '_Digite *menu* para outras opções._',
    ].join('\n')
  },
  contratosVazio: () =>
    'Você não possui contratos ativos no momento. ℹ️',
  contratosLista: (itens: Array<{ idx: number; convenio: string; numeroVenda: number; qtd: number; valorParcela: number; valorTotal: number; dataEmissao: string; pagas: number }>) => {
    const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    const linhas = ['📋 *Seus contratos ativos:*', '']
    for (const it of itens) {
      linhas.push(`*${it.idx})* ${it.convenio} — Venda #${it.numeroVenda}`)
      linhas.push(`   ${it.qtd}x ${brl(it.valorParcela)} · total ${brl(it.valorTotal)}`)
      linhas.push(`   Emitida em ${it.dataEmissao} · ${it.pagas}/${it.qtd} pagas`)
    }
    linhas.push('')
    linhas.push('_Digite o número para ver o espelho do contrato._')
    return linhas.join('\n')
  },
  contratoEspelho: (item: {
    convenio: string
    numeroVenda: number
    dataEmissao: string
    qtd: number
    valorParcela: number
    valorTotal: number
    pagas: number
    proximas: Array<{ numero: number; dataVenc: string; valor: number }>
  }) => {
    const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
    const linhas = [
      '📋 *Espelho do contrato*',
      '',
      `📌 Convênio: *${item.convenio}*`,
      `🔢 Venda nº: *${item.numeroVenda}*`,
      `📅 Emitida em: ${item.dataEmissao}`,
      '',
      `💳 Parcelas: ${item.qtd}x ${brl(item.valorParcela)}`,
      `💰 Valor total: ${brl(item.valorTotal)}`,
      `✔️ Pagas: ${item.pagas}/${item.qtd}`,
    ]
    if (item.proximas.length > 0) {
      linhas.push('')
      linhas.push('*Próximas parcelas:*')
      for (const p of item.proximas) {
        linhas.push(`• ${p.numero}/${item.qtd} · ${p.dataVenc} · ${brl(p.valor)}`)
      }
    }
    linhas.push('')
    linhas.push('_Para receber o contrato em PDF, digite *atendente*._')
    linhas.push('_Digite *menu* para outras opções._')
    return linhas.join('\n')
  },
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

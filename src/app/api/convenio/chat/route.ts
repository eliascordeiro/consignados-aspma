import { NextRequest, NextResponse } from 'next/server'
import { getConvenioSession } from '@/lib/convenio-auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
})

// Contexto do sistema sobre o portal
function buildSystemPrompt(convenioNome: string, tipo: string | null): string {
  return `Você é o assistente virtual do Portal do Conveniado do Sistema de Consignados ASPMA.
Seu nome é "Assistente ASPMA". Você deve ser cordial, profissional e objetivo.

SOBRE O SISTEMA:
- Este é um sistema de gestão de consignados (empréstimos consignados em folha de pagamento)
- Os conveniados (empresas/bancos/comércio) fazem vendas consignadas para sócios/funcionários
- Cada venda gera parcelas que são descontadas em folha de pagamento

FUNCIONALIDADES DO PORTAL:
1. **Dashboard**: Visão geral com total de vendas, vendas do mês e valor total
2. **Nova Venda**: Buscar sócio → consultar margem consignável → informar parcelas e valor → registrar venda
3. **Tabela de Vendas**: Listar, filtrar (por nome, matrícula, CPF, status, data) e ver parcelas de cada venda
4. **Relatórios**: 
   - Vendas por Período: resumo com totais, filtrado por datas
   - Parcelas a Receber: parcelas pendentes de pagamento

CONCEITOS IMPORTANTES:
- **Margem consignável**: percentual máximo do salário que pode ser comprometido com consignados (geralmente 30%)
- **Limite disponível**: valor que o sócio ainda pode comprometer (Limite Total - Parcelas em aberto)
- **Parcela**: cada prestação mensal de uma venda
- **Baixa**: quando a parcela é paga/descontada
- **Sócio**: funcionário/associado que recebe o empréstimo
- **Conveniado**: empresa que concede o empréstimo (${tipo ? `tipo: ${tipo}` : 'você'})

REGRAS:
- Você está falando com o conveniado "${convenioNome}"
- Responda APENAS sobre o sistema de consignados e o portal
- Se não souber algo específico do banco de dados, sugira que o conveniado use as telas do portal
- Não invente dados numéricos (valores, quantidades) - sugira que consultem o dashboard ou relatórios
- Responda em português do Brasil
- Seja conciso (máximo 3-4 parágrafos por resposta)
- Use emojis moderadamente para tornar a conversa agradável
- Se perguntarem algo fora do escopo, redirecione educadamente para assuntos do portal`
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getConvenioSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { messages } = (await request.json()) as { messages: ChatMessage[] }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Mensagens são obrigatórias' },
        { status: 400 }
      )
    }

    // Verificar se a API key está configurada
    if (!process.env.GROQ_API_KEY) {
      // Fallback: respostas pré-definidas quando não há API key
      return NextResponse.json({
        message: getFallbackResponse(messages[messages.length - 1].content),
      })
    }

    // Buscar dados resumidos do conveniado para contexto
    let statsContext = ''
    try {
      const [totalVendas, vendasMes] = await Promise.all([
        prisma.venda.count({
          where: { convenioId: session.convenioId, cancelado: false },
        }),
        prisma.venda.count({
          where: {
            convenioId: session.convenioId,
            cancelado: false,
            dataEmissao: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ])
      statsContext = `\n\nDADOS ATUAIS DO CONVENIADO (use apenas se perguntarem):
- Total de vendas ativas: ${totalVendas}
- Vendas neste mês: ${vendasMes}`
    } catch {
      // Silenciar erros de consulta
    }

    const systemPrompt = buildSystemPrompt(
      session.fantasia || session.razaoSocial,
      session.tipo
    ) + statsContext

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 800,
    })

    const reply = chatCompletion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta. Tente novamente.'

    return NextResponse.json({ message: reply })
  } catch (error: any) {
    console.error('Erro no chat:', error)

    // Se for erro de rate limit ou API
    if (error?.status === 429) {
      return NextResponse.json({
        message: '⏳ O assistente está com muitas solicitações no momento. Aguarde alguns segundos e tente novamente.',
      })
    }

    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}

// Respostas de fallback quando não há API key configurada
function getFallbackResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase()

  if (msg.includes('olá') || msg.includes('oi') || msg.includes('bom dia') || msg.includes('boa tarde') || msg.includes('boa noite')) {
    return '👋 Olá! Sou o Assistente ASPMA. Como posso ajudar você hoje?\n\nPosso tirar dúvidas sobre:\n• Como fazer uma nova venda\n• Como consultar margem consignável\n• Relatórios e parcelas\n• Funcionalidades do portal'
  }

  if (msg.includes('venda') || msg.includes('nova venda')) {
    return '🛒 **Para fazer uma nova venda:**\n\n1. Acesse o menu **Vendas → Nova Venda**\n2. Busque o sócio por nome, matrícula ou CPF\n3. O sistema mostrará a margem disponível automaticamente\n4. Informe o número de parcelas e o valor\n5. Confirme a operação\n\n💡 O sistema verifica automaticamente se há margem disponível antes de permitir a venda.'
  }

  if (msg.includes('margem') || msg.includes('limite')) {
    return '📊 **Margem Consignável:**\n\nA margem é o valor máximo que o sócio pode comprometer com consignados.\n\n• **Limite Total** = Salário × Percentual de margem (geralmente 30%)\n• **Limite Disponível** = Limite Total - Parcelas em aberto\n\nPara consultar a margem, acesse **Vendas → Nova Venda** e busque o sócio. A margem será exibida automaticamente.'
  }

  if (msg.includes('parcela') || msg.includes('receber') || msg.includes('pagamento')) {
    return '💰 **Parcelas e Pagamentos:**\n\nAs parcelas são descontadas automaticamente em folha de pagamento.\n\n• Para ver parcelas de uma venda específica, vá em **Tabela de Vendas** e clique na venda\n• Para um resumo geral, acesse **Relatórios → Parcelas a Receber**\n• Parcelas com status "Paga" já foram descontadas'
  }

  if (msg.includes('relatório') || msg.includes('relatorio')) {
    return '📈 **Relatórios Disponíveis:**\n\n1. **Vendas por Período**: Filtrar vendas por data, ver resumo com totais e exportar\n2. **Parcelas a Receber**: Ver todas as parcelas pendentes, filtrar por vencimento\n\nAcesse o menu **Relatórios** para utilizar.'
  }

  if (msg.includes('cancelar') || msg.includes('cancelamento')) {
    return '❌ **Cancelamento de Vendas:**\n\nPara informações sobre cancelamento de vendas, entre em contato com o administrador do sistema. O cancelamento depende das políticas da instituição e do status das parcelas.'
  }

  return '🤖 Sou o Assistente ASPMA! Posso ajudar com dúvidas sobre:\n\n• 🛒 **Nova Venda** — como registrar vendas\n• 📊 **Margem** — consulta de margem consignável\n• 💰 **Parcelas** — pagamentos e vencimentos\n• 📈 **Relatórios** — vendas e recebíveis\n\nDigite sua dúvida e ficarei feliz em ajudar! 😊'
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
})

function buildSystemPrompt(userName: string): string {
  return `Você é o assistente virtual do Sistema de Consignados ASPMA (painel administrativo/gerencial).
Seu nome é "Assistente ASPMA". Você deve ser cordial, profissional e objetivo.

SOBRE O SISTEMA:
- Este é um sistema de gestão de consignados (empréstimos consignados em folha de pagamento)
- O administrador gerencia funcionários, convênios, consignatárias, vendas e relatórios

FUNCIONALIDADES DO PAINEL:
1. **Funcionários**: Cadastrar, editar, inativar funcionários; gerenciar matrícula e margem consignável
2. **Convênios**: Gerenciar os convênios disponíveis para consignação
3. **Consignatárias**: Gerenciar as empresas que oferecem crédito consignado
4. **Vendas**: Listar, filtrar e cancelar vendas registradas pelos conveniados
5. **Locais**: Cadastrar locais de trabalho vinculados aos funcionários
6. **Relatórios**: Vendas por período, parcelas a receber, exportação de dados
7. **Usuários**: Criar e gerenciar usuários do painel com permissões específicas
8. **Logs**: Auditoria de todas as operações realizadas no sistema

CONCEITOS IMPORTANTES:
- **Margem consignável**: percentual máximo do salário comprometível com consignados (geralmente 30%)
- **Parcela**: cada prestação mensal de uma venda
- **Baixa**: quando a parcela é paga/descontada em folha
- **Conveniado**: empresa que concede o empréstimo/crédito
- **Funcionário/Sócio**: pessoa que recebe o crédito consignado

REGRAS:
- Você está falando com o administrador "${userName}"
- Responda APENAS sobre o sistema de consignados ASPMA
- Se não souber algo específico do banco de dados, sugira que o usuário use as telas do painel
- Não invente dados numéricos — sugira que consultem os relatórios e dashboards
- Responda em português do Brasil
- Seja conciso (máximo 3-4 parágrafos por resposta)
- Use emojis moderadamente
- Se perguntarem algo fora do escopo, redirecione para assuntos do sistema`
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { messages } = (await request.json()) as { messages: ChatMessage[] }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Mensagens são obrigatórias' }, { status: 400 })
    }

    // Fallback without API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({
        message: getFallbackResponse(messages[messages.length - 1].content),
      })
    }

    // Optional stats context
    let statsContext = ''
    try {
      const [totalFuncionarios, totalVendas, vendasMes] = await Promise.all([
        prisma.funcionarios.count({ where: { ativo: true } }),
        prisma.venda.count({ where: { cancelado: false } }),
        prisma.venda.count({
          where: {
            cancelado: false,
            dataEmissao: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ])
      statsContext = `\n\nDADOS GERAIS DO SISTEMA (use apenas se perguntarem):
- Funcionários ativos: ${totalFuncionarios}
- Total de vendas ativas: ${totalVendas}
- Vendas neste mês: ${vendasMes}`
    } catch {
      // silenciar erros de consulta
    }

    const systemPrompt = buildSystemPrompt(session.user.name || session.user.email || 'Administrador') + statsContext

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

    const reply =
      chatCompletion.choices[0]?.message?.content ||
      'Desculpe, não consegui processar sua pergunta. Tente novamente.'

    return NextResponse.json({ message: reply })
  } catch (error: any) {
    console.error('Erro no chat cliente:', error)

    if (error?.status === 429) {
      return NextResponse.json({
        message: '⏳ O assistente está com muitas solicitações no momento. Aguarde alguns segundos e tente novamente.',
      })
    }

    return NextResponse.json({ error: 'Erro ao processar mensagem' }, { status: 500 })
  }
}

function getFallbackResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase()

  if (msg.includes('olá') || msg.includes('oi') || msg.includes('bom dia') || msg.includes('boa tarde') || msg.includes('boa noite')) {
    return '👋 Olá! Sou o Assistente ASPMA. Como posso ajudar?\n\nPosso tirar dúvidas sobre:\n• Funcionários e margem consignável\n• Vendas e parcelas\n• Convênios e consignatárias\n• Relatórios e exportação'
  }

  if (msg.includes('funcionário') || msg.includes('funcionario') || msg.includes('sócio') || msg.includes('socio')) {
    return '👤 **Funcionários:**\n\nAcesse o menu **Funcionários** para:\n• Cadastrar novos funcionários\n• Editar dados e matrícula\n• Consultar margem consignável\n• Inativar registros'
  }

  if (msg.includes('venda') || msg.includes('consignação') || msg.includes('consignacao')) {
    return '🛒 **Vendas:**\n\nNo menu **Vendas** você pode:\n• Listar todas as vendas registradas pelos conveniados\n• Filtrar por data, funcionário, convênio ou status\n• Cancelar vendas quando necessário\n• Ver parcelas de cada venda'
  }

  if (msg.includes('margem') || msg.includes('limite')) {
    return '📊 **Margem Consignável:**\n\nA margem é o valor máximo que o funcionário pode comprometer com consignados.\n\n• **Limite Total** = Salário × Percentual de margem\n• **Limite Disponível** = Limite Total − Parcelas em aberto\n\nConsulte na tela de **Funcionários** → editar registro.'
  }

  if (msg.includes('relatório') || msg.includes('relatorio')) {
    return '📈 **Relatórios:**\n\n• **Vendas por Período** — filtrar por data e exportar\n• **Parcelas a Receber** — parcelas pendentes\n\nAcesse o menu **Relatórios** no painel.'
  }

  if (msg.includes('convênio') || msg.includes('convenio')) {
    return '🏢 **Convênios:**\n\nNo menu **Convênios** você pode cadastrar e gerenciar os convênios disponíveis para consignação. Cada conveniado acessa o portal separadamente para registrar as vendas.'
  }

  if (msg.includes('usuário') || msg.includes('usuario') || msg.includes('permissão') || msg.includes('permissao')) {
    return '🔐 **Usuários e Permissões:**\n\nNo menu **Usuários** você pode criar contas para outros operadores do painel e definir permissões específicas por módulo (funcionários, vendas, relatórios, etc.).'
  }

  return '🤖 Sou o Assistente ASPMA! Posso ajudar com:\n\n• 👤 **Funcionários** — cadastro e margem\n• 🛒 **Vendas** — listagem e parcelas\n• 🏢 **Convênios/Consignatárias**\n• 📈 **Relatórios**\n• 🔐 **Usuários e permissões**\n\nDigite sua dúvida!'
}

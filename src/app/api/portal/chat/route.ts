import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

async function getSocioId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('portal_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.socioId as string
  } catch {
    return null
  }
}

function buildSystemPrompt(nomeSocio: string, stats?: { totalCompras: number; empresa: string }): string {
  const statsContext = stats
    ? `\n\nDADOS DO SÓCIO:\n- Empresa/órgão: ${stats.empresa}\n- Contratos ativos: ${stats.totalCompras}`
    : ''

  return `Você é o assistente virtual do Portal do Sócio ASPMA.
Seu nome é "Assistente ASPMA". Seja cordial, prestativo e objetivo.

O sócio que está conversando com você se chama "${nomeSocio}".${statsContext}

SOBRE O PORTAL:
- Este é o portal pessoal do sócio da ASPMA (Associação dos Servidores da PMA)
- O sócio pode consultar: margem consignada, descontos em folha, compras/contratos e perfil

FUNCIONALIDADES DO PORTAL:
1. **Dashboard**: Margem disponível, vencimentos do mês, últimas compras
2. **Descontos**: Parcelas que serão descontadas em folha por mês
3. **Compras**: Lista de todos os contratos/compras ativas e suas parcelas
4. **Perfil**: Dados cadastrais (nome, matrícula, celular, e-mail)

CONCEITOS IMPORTANTES:
- **Margem consignável**: valor máximo que pode ser comprometido mensalmente com consignados (descontos em folha)
- **Parcela**: prestação mensal de um contrato
- **Desconto em folha**: parcela debitada diretamente do salário/vencimento
- **ASPMA**: Associação dos Servidores da PMA — entidade gestora dos consignados

COMO AJUDAR:
- Explique como navegar pelo portal e usar cada funcionalidade
- Esclareça dúvidas sobre margem consignável, parcelas e descontos
- Para problemas de acesso ou senha, oriente o sócio a entrar em contato com a ASPMA
- Não invente dados financeiros — oriente a consultar as telas do portal

REGRAS:
- Responda APENAS sobre o portal do sócio e dúvidas relacionadas à ASPMA/consignados
- Responda em português do Brasil
- Seja conciso (máximo 3 parágrafos)
- Use emojis moderadamente`
}

function getFallbackResponse(message: string): string {
  const msg = message.toLowerCase()

  if (msg.includes('margem')) {
    return 'A margem consignável é o valor máximo que pode ser comprometido mensalmente com consignados. Você pode consultar sua margem disponível no Dashboard do portal. 💰'
  }
  if (msg.includes('desconto') || msg.includes('parcela') || msg.includes('folha')) {
    return 'Na seção **Descontos** do portal você encontra todas as parcelas que serão descontadas em folha, organizadas por mês de vencimento. 📅'
  }
  if (msg.includes('compra') || msg.includes('contrato')) {
    return 'Em **Compras** você visualiza todos os seus contratos ativos com detalhes das parcelas, valores e status de pagamento. 🛍️'
  }
  if (msg.includes('perfil') || msg.includes('dados cadastrais') || msg.includes('cadastro')) {
    return 'Seus dados cadastrais (matrícula, celular, e-mail) podem ser consultados na seção **Perfil** do portal. 👤'
  }
  if (msg.includes('senha') || msg.includes('acesso') || msg.includes('login')) {
    return 'Para problemas de acesso ou redefinição de senha, entre em contato diretamente com a ASPMA. Eles poderão ajudar com seu cadastro. 🔐'
  }
  if (msg.includes('aspma') || msg.includes('associação') || msg.includes('contato')) {
    return 'A ASPMA (Associação dos Servidores da PMA) é a entidade responsável pela gestão dos consignados. Para dúvidas específicas ou problemas, entre em contato com a ASPMA diretamente. 📞'
  }

  return 'Olá! Sou o assistente virtual do Portal do Sócio ASPMA. Posso ajudar com dúvidas sobre margem consignável, descontos em folha, compras/contratos e navegação no portal. Como posso ajudar? 😊'
}

export async function POST(request: NextRequest) {
  const socioId = await getSocioId(request)
  if (!socioId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { messages } = await request.json()

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: {
      nome: true,
      empresa: { select: { nome: true } },
      _count: { select: { vendas: { where: { ativo: true, cancelado: false } } } },
    },
  })

  const nomeSocio = socio?.nome || 'Sócio'
  const stats = socio
    ? {
        totalCompras: socio._count.vendas,
        empresa: socio.empresa?.nome || 'não informada',
      }
    : undefined

  if (!process.env.GROQ_API_KEY) {
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop()
    const fallback = getFallbackResponse(lastUserMessage?.content || '')
    return NextResponse.json({ message: fallback })
  }

  try {
    const systemPrompt = buildSystemPrompt(nomeSocio, stats)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.6,
      max_tokens: 800,
    })

    const message = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.'
    return NextResponse.json({ message })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 429) {
      const lastUserMessage = messages.filter((m: { role: string }) => m.role === 'user').pop()
      const fallback = getFallbackResponse(lastUserMessage?.content || '')
      return NextResponse.json({ message: fallback })
    }
    console.error('Groq API error:', error)
    return NextResponse.json({ message: 'Desculpe, ocorreu um erro. Tente novamente em instantes.' }, { status: 500 })
  }
}

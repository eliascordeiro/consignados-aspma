/**
 * Cliente Groq (LLM rápido e gratuito) para fallback inteligente do chatbot.
 * Usa o modelo llama-3.1-8b-instant (rápido, baixíssimo custo, ótimo PT-BR).
 *
 * Apenas é chamado quando a detecção por keywords falha (intent UNKNOWN)
 * e a sessão está em um estado conversacional (não em fluxo guiado de auth).
 */

const SYSTEM_PROMPT = `Você é o assistente virtual da ASPMA Consignados, uma cooperativa de crédito consignado para servidores públicos no Paraná.

REGRAS RÍGIDAS:
- Responda SEMPRE em português brasileiro, de forma curta (máx 3 frases) e cordial
- NUNCA invente valores, taxas, prazos ou dados pessoais. Se não souber, oriente o sócio a falar com uma colaboradora pelo *41 98831-8343*
- NUNCA peça CPF, senha, dados bancários ou informações sensíveis (o sistema cuida disso)
- NUNCA ofereça serviços que não estão na lista abaixo
- Se a pergunta for sobre algo fora do escopo (clima, política, piadas, outros assuntos), redirecione gentilmente ao menu

ESCOPO PERMITIDO:
1. Margem disponível (consulta automática após autenticação)
2. Descontos do mês (parcelas em aberto)
3. Falar com colaboradora humana pelo *41 98831-8343*
4. Dúvidas gerais sobre crédito consignado

QUANDO O USUÁRIO PERGUNTAR ALGO QUE VOCÊ PODE RESPONDER, sempre termine sugerindo: "Digite *menu* para ver as opções."
QUANDO NÃO SOUBER OU FOR SENSÍVEL, responda: "Não tenho essa informação. Para falar com uma colaboradora da ASPMA, chame no *41 98831-8343*."`

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

export async function groqChat(
  userText: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  const messages: Msg[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6), // últimas 6 mensagens de contexto
    { role: 'user', content: userText },
  ]

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages,
        temperature: 0.4,
        max_tokens: 220,
      }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) {
      console.warn('[groq] HTTP', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data: any = await res.json()
    const txt = data?.choices?.[0]?.message?.content?.trim()
    return txt && txt.length > 0 ? txt : null
  } catch (e: any) {
    console.warn('[groq] erro:', e?.message || e)
    return null
  }
}

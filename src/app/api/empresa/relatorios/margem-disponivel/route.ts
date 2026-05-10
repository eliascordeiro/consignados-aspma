import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// GET /api/empresa/relatorios/margem-disponivel
// Retorna sócios ativos com margem consumida vs disponível.
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Sócios ativos da empresa
  const socios = await prisma.socio.findMany({
    where: { empresaId: session.empresaId, ativo: true },
    select: {
      id: true,
      nome: true,
      matricula: true,
      bloqueio: true,
      limite: true,
      margemConsig: true,
    },
    orderBy: { nome: 'asc' },
  })

  // Para calcular consumo, somar parcelas a vencer hoje em diante das vendas ativas
  const socioIds = socios.map((s) => s.id)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Agregar valor das parcelas pendentes por sócio (via venda)
  const parcelas = await prisma.parcela.findMany({
    where: {
      venda: { empresaId: session.empresaId, ativo: true, cancelado: false, socioId: { in: socioIds } },
      baixa: null,
      dataVencimento: { gte: today },
    },
    select: { valor: true, venda: { select: { socioId: true } } },
  })

  const consumoMap = new Map<string, number>()
  for (const p of parcelas) {
    const sid = p.venda.socioId
    consumoMap.set(sid, (consumoMap.get(sid) || 0) + Number(p.valor))
  }

  const items = socios.map((s) => {
    const margem = Number(s.margemConsig || 0)
    const consumido = consumoMap.get(s.id) || 0
    const disponivel = Math.max(0, margem - consumido)
    const pct = margem > 0 ? Math.min(100, (consumido / margem) * 100) : 0
    return {
      id: s.id,
      nome: s.nome,
      matricula: s.matricula,
      bloqueado: !!s.bloqueio,
      limite: Number(s.limite || 0),
      margemTotal: margem,
      consumido,
      disponivel,
      pctConsumida: pct,
    }
  })

  const totais = items.reduce(
    (acc, i) => {
      acc.margemTotal += i.margemTotal
      acc.consumido += i.consumido
      acc.disponivel += i.disponivel
      return acc
    },
    { margemTotal: 0, consumido: 0, disponivel: 0 }
  )

  return NextResponse.json({ items, totais, total: items.length })
}

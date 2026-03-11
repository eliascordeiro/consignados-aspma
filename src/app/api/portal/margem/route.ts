import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { consultarMargem, formatCpf } from '@/lib/zetra-soap'
import { calcularDataCorte } from '@/lib/data-corte'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function GET(request: NextRequest) {
  const token = request.cookies.get('portal_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let socioId: string
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    socioId = payload.socioId as string
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: {
      tipo: true,
      matricula: true,
      cpf: true,
      margemConsig: true,
      limite: true,
      empresa: { select: { diaCorte: true } },
    },
  })

  if (!socio) return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })

  // tipos 3/4 = cálculo local (limite - descontos do mês)
  if (socio.tipo === '3' || socio.tipo === '4') {
    const dataCorte = calcularDataCorte(socio.empresa?.diaCorte ?? 9)
    const descontos = await prisma.parcela.aggregate({
      _sum: { valor: true },
      where: {
        venda: { socioId, ativo: true, cancelado: false },
        OR: [{ baixa: '' }, { baixa: null }, { baixa: 'N' }],
        dataVencimento: {
          gte: new Date(dataCorte.ano, dataCorte.mes - 1, 1),
          lt: new Date(dataCorte.ano, dataCorte.mes, 1),
        },
      },
    })
    const limite = Number(socio.limite || 0)
    const totalDescontos = Number(descontos._sum.valor || 0)
    const margem = limite - totalDescontos
    return NextResponse.json({ fonte: 'local', margem })
  }

  // tipos != 3/4 = consulta direta ao ZETRA via SOAP
  const matricula = (socio.matricula || '').trim()
  const cpf = formatCpf(socio.cpf || '')

  if (!matricula || !cpf) {
    return NextResponse.json({
      fonte: 'banco',
      margem: Number(socio.margemConsig || 0),
    })
  }

  try {
    console.log('[PORTAL MARGEM ZETRA] Consultando SOAP:', { matricula, cpf })

    const result = await consultarMargem({ matricula, cpf, valorParcela: '0.10' })

    console.log('[PORTAL MARGEM ZETRA] Resposta:', result)

    if (!result.success) {
      console.error('[PORTAL MARGEM ZETRA] Erro na consulta:', result.error)
      return NextResponse.json({
        fonte: 'zetra_erro',
        margem: Number(socio.margemConsig || 0),
        mensagem: result.error?.message || 'Erro desconhecido',
      })
    }

    const valorMargem = result.data?.valorMargem || result.data?.margem || '0'
    const margem = parseFloat(String(valorMargem))
    console.log('[PORTAL MARGEM ZETRA] Sucesso! margem:', margem)
    return NextResponse.json({ fonte: 'zetra', margem })
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.code === 23 || err?.message?.includes('timeout')
    console.error(`[PORTAL MARGEM ZETRA] ${isTimeout ? 'TIMEOUT' : 'ERRO'}:`, err?.message || err)
    return NextResponse.json({
      fonte: isTimeout ? 'timeout' : 'fallback',
      margem: Number(socio.margemConsig || 0),
    })
  }
}

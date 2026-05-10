import { NextRequest, NextResponse } from 'next/server'
import { requireEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'

// GET /api/empresa/dashboard
// Estatísticas agregadas para o dashboard da consignatária.
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireEmpresaSession(request)
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const empresaId = session.empresaId
  const now = new Date()
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
  const inicioProxMes = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // Funcionários (sócios) da empresa
  const [
    totalSocios,
    sociosAtivos,
    sociosBloqueados,
    sociosInativos,
    margemAgg,
    limiteAgg,
    vendasAtivasCount,
    vendasMesCount,
    vendasMesAgg,
    vendasCanceladasMes,
    parcelasMesAgg,
    parcelasMesPagas,
    parcelasFuturasAgg,
    parcelasAtrasadasAgg,
  ] = await Promise.all([
    prisma.socio.count({ where: { empresaId } }),
    prisma.socio.count({
      where: { empresaId, ativo: true, bloqueio: null },
    }),
    prisma.socio.count({
      where: { empresaId, bloqueio: { not: null } },
    }),
    prisma.socio.count({ where: { empresaId, ativo: false } }),

    prisma.socio.aggregate({
      where: { empresaId, ativo: true },
      _sum: { margemConsig: true },
    }),
    prisma.socio.aggregate({
      where: { empresaId, ativo: true },
      _sum: { limite: true },
    }),

    prisma.venda.count({
      where: { empresaId, ativo: true, cancelado: false },
    }),
    prisma.venda.count({
      where: {
        empresaId,
        dataEmissao: { gte: inicioMes, lt: inicioProxMes },
        cancelado: false,
      },
    }),
    prisma.venda.aggregate({
      where: {
        empresaId,
        dataEmissao: { gte: inicioMes, lt: inicioProxMes },
        cancelado: false,
      },
      _sum: { valorTotal: true },
    }),
    prisma.venda.count({
      where: {
        empresaId,
        cancelado: true,
        updatedAt: { gte: inicioMes, lt: inicioProxMes },
      },
    }),

    // Parcelas do mês atual (vinculadas a vendas da empresa)
    prisma.parcela.aggregate({
      where: {
        venda: { empresaId, ativo: true, cancelado: false },
        dataVencimento: { gte: inicioMes, lt: inicioProxMes },
      },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.parcela.count({
      where: {
        venda: { empresaId, ativo: true, cancelado: false },
        dataVencimento: { gte: inicioMes, lt: inicioProxMes },
        baixa: 'S',
      },
    }),
    prisma.parcela.aggregate({
      where: {
        venda: { empresaId, ativo: true, cancelado: false },
        dataVencimento: { gte: inicioProxMes },
        baixa: null,
      },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.parcela.aggregate({
      where: {
        venda: { empresaId, ativo: true, cancelado: false },
        dataVencimento: { lt: inicioMes },
        baixa: null,
      },
      _sum: { valor: true },
      _count: true,
    }),
  ])

  return NextResponse.json({
    socios: {
      total: totalSocios,
      ativos: sociosAtivos,
      bloqueados: sociosBloqueados,
      inativos: sociosInativos,
    },
    margem: {
      totalDisponivel: Number(margemAgg._sum.margemConsig || 0),
      limiteTotal: Number(limiteAgg._sum.limite || 0),
    },
    vendas: {
      ativas: vendasAtivasCount,
      mesAtual: vendasMesCount,
      valorMesAtual: Number(vendasMesAgg._sum.valorTotal || 0),
      canceladasMes: vendasCanceladasMes,
    },
    parcelas: {
      mesAtual: {
        quantidade: parcelasMesAgg._count,
        valor: Number(parcelasMesAgg._sum.valor || 0),
        pagas: parcelasMesPagas,
        pendentes: parcelasMesAgg._count - parcelasMesPagas,
      },
      futuras: {
        quantidade: parcelasFuturasAgg._count,
        valor: Number(parcelasFuturasAgg._sum.valor || 0),
      },
      atrasadas: {
        quantidade: parcelasAtrasadasAgg._count,
        valor: Number(parcelasAtrasadasAgg._sum.valor || 0),
      },
    },
    empresa: {
      id: empresaId,
      nome: session.nome,
      diaCorte: session.diaCorte,
    },
  })
}

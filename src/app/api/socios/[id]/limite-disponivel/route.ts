import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestInfo } from '@/lib/audit-log'
import { calcularDataCorte } from '@/lib/data-corte'

/**
 * GET /api/socios/[id]/limite-disponivel
 * 
 * Calcula o limite disponível do sócio baseado na lógica do AS200.PRG:
 * Limite Disponível = Limite Total - Descontos do mês de referência
 * 
 * Data de corte: se dia atual > diaCorte (da consignatária), 
 * considera parcelas do mês seguinte; senão, do mês atual.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestInfo = getRequestInfo(request)

    // Buscar sócio com empresa (para diaCorte)
    const socio = await prisma.socio.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        matricula: true,
        limite: true,
        tipo: true,
        empresa: { select: { diaCorte: true } },
      }
    })

    if (!socio) {
      return NextResponse.json(
        { error: 'Sócio não encontrado' },
        { status: 404 }
      )
    }

    const limiteTotal = Number(socio.limite) || 0

    // Se tipo 3 ou 4 (local), calcula limite local: limite - descontos do mês de referência
    // AS200.PRG linha 1130: pLimite := oLimite - nLimite
    if (socio.tipo === '3' || socio.tipo === '4') {
      // Calcula data de corte usando o diaCorte da consignatária (empresa) do sócio
      const dataCorte = calcularDataCorte(socio.empresa?.diaCorte ?? 9)

      // Busca soma das parcelas do mês de referência em aberto (baixa = null, vazio ou 'N')
      const result = await prisma.parcela.aggregate({
        _sum: { valor: true },
        where: {
          venda: {
            socioId: socio.id,
            ativo: true,
            cancelado: false
          },
          OR: [
            { baixa: null },
            { baixa: '' },
            { baixa: 'N' },
          ],
          dataVencimento: {
            gte: new Date(dataCorte.ano, dataCorte.mes - 1, 1),
            lt: new Date(dataCorte.ano, dataCorte.mes, 1),
          },
        },
      })

      const totalEmAberto = Number(result._sum.valor || 0)
      const limiteDisponivel = limiteTotal - totalEmAberto

      return NextResponse.json({
        limiteTotal,
        totalEmAberto,
        limiteDisponivel,
        mesReferencia: `${dataCorte.mes}/${dataCorte.ano}`,
        tipo: socio.tipo,
        tipoDescricao: 'Local',
        socio: {
          id: socio.id,
          nome: socio.nome,
          matricula: socio.matricula
        }
      })
    }

    // Para tipos 1 e 2 (ZETRA), retorna apenas o limite
    // (margem real vem da consulta ZETRA via /api/socios/[id]/margem)
    return NextResponse.json({
      limiteTotal,
      totalEmAberto: 0,
      limiteDisponivel: limiteTotal,
      tipo: socio.tipo,
      tipoDescricao: 'ZETRA',
      socio: {
        id: socio.id,
        nome: socio.nome,
        matricula: socio.matricula
      },
      aviso: 'Para sócios ZETRA, consulte /api/socios/[id]/margem para margem real'
    })

  } catch (error) {
    console.error('❌ Erro ao calcular limite disponível:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular limite disponível' },
      { status: 500 }
    )
  }
}

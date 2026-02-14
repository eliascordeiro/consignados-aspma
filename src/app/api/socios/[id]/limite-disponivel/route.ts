import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestInfo } from '@/lib/audit-log'

/**
 * GET /api/socios/[id]/limite-disponivel
 * 
 * Calcula o limite disponível do sócio baseado na lógica do AS200.PRG:
 * Limite Disponível = Limite Total - Total em Aberto (parcelas não pagas)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestInfo = getRequestInfo(request)

    // Buscar sócio
    const socio = await prisma.socio.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        matricula: true,
        limite: true,
        tipo: true,
      }
    })

    if (!socio) {
      return NextResponse.json(
        { error: 'Sócio não encontrado' },
        { status: 404 }
      )
    }

    const limiteTotal = Number(socio.limite) || 0

    // Se tipo 3 ou 4 (local), calcula limite local: limite - parcelas em aberto
    // AS200.PRG linha 1130: pLimite := oLimite - nLimite
    if (socio.tipo === '3' || socio.tipo === '4') {
      // Busca soma das parcelas em aberto (baixa = null ou vazio)
      // AS200.PRG linha 1126: WHERE ... and baixa = '' 
      const parcelasEmAberto = await prisma.parcela.findMany({
        where: {
          venda: {
            socioId: socio.id,
            ativo: true,
            cancelado: false
          },
          baixa: { in: [null, ''] } // Parcelas não pagas
        },
        select: {
          valor: true
        }
      })

      const totalEmAberto = parcelasEmAberto.reduce((sum, p) => sum + Number(p.valor), 0)
      const limiteDisponivel = limiteTotal - totalEmAberto

      return NextResponse.json({
        limiteTotal,
        totalEmAberto,
        limiteDisponivel,
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

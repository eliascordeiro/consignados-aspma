'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface Parcela {
  id: string
  numeroParcela: number
  dataVencimento: string | null
  valor: number
  baixa: string | null
  dataBaixa: string | null
  valorPago: number | null
}

interface Venda {
  id: string
  numeroVenda: number
  quantidadeParcelas: number
  valorParcela: number
  convenio: { razao_soc: string; codigo: string } | null
  parcelas: Parcela[]
}

interface Socio {
  nome: string
  empresa: { nome: string; diaCorte: number } | null
  vendas: Venda[]
}

interface ParcelaFlat {
  parcelaId: string
  vendaId: string
  numeroVenda: number
  numeroParcela: number
  totalParcelas: number
  convenio: string
  dataVencimento: string | null
  valor: number
  baixa: string | null
  dataBaixa: string | null
  valorPago: number | null
  mesAno: string // 'MM/YYYY'
  mesAnoKey: number // YYYYMM for sorting
}

interface GrupoMes {
  label: string // 'Maio 2025'
  mesAno: string
  parcelas: ParcelaFlat[]
  totalPendente: number
}

function nomeMes(mes: number) {
  return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
          'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][mes - 1]
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function ExtratoPage() {
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then((data: Socio) => {
        setSocio(data)
        // Expande automaticamente o grupo mais recente
        const parcelas = flattenParcelas(data.vendas)
        const groups = groupByMonth(parcelas)
        if (groups.length > 0) {
          setExpandedGroups(new Set([groups[0].mesAno]))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function flattenParcelas(vendas: Venda[]): ParcelaFlat[] {
    const flat: ParcelaFlat[] = []
    for (const venda of vendas) {
      const conv = venda.convenio?.razao_soc || `Empréstimo #${venda.numeroVenda}`
      for (const p of venda.parcelas) {
        const venc = p.dataVencimento ? new Date(p.dataVencimento.slice(0,10) + 'T12:00:00') : null
        const mes = venc ? venc.getMonth() + 1 : 0
        const ano = venc ? venc.getFullYear() : 0
        const mesAno = venc ? `${String(mes).padStart(2,'0')}/${ano}` : 'Sem data'
        const mesAnoKey = venc ? ano * 100 + mes : 0
        flat.push({
          parcelaId: p.id,
          vendaId: venda.id,
          numeroVenda: venda.numeroVenda,
          numeroParcela: p.numeroParcela,
          totalParcelas: venda.quantidadeParcelas,
          convenio: conv,
          dataVencimento: p.dataVencimento,
          valor: p.valor,
          baixa: p.baixa,
          dataBaixa: p.dataBaixa,
          valorPago: p.valorPago,
          mesAno,
          mesAnoKey,
        })
      }
    }
    return flat
  }

  function groupByMonth(parcelas: ParcelaFlat[]): GrupoMes[] {
    const map = new Map<string, ParcelaFlat[]>()
    const keyMap = new Map<string, number>()
    for (const p of parcelas) {
      if (!map.has(p.mesAno)) {
        map.set(p.mesAno, [])
        keyMap.set(p.mesAno, p.mesAnoKey)
      }
      map.get(p.mesAno)!.push(p)
    }
    const groups: GrupoMes[] = []
    for (const [mesAno, items] of map) {
      const sorted = [...items].sort((a,b) => a.numeroParcela - b.numeroParcela)
      const totalPendente = sorted
        .filter(i => i.baixa !== 'S')
        .reduce((s,i) => s + Number(i.valor), 0)
      // Parse label from MM/YYYY
      const parts = mesAno.split('/')
      const label = parts.length === 2
        ? `${nomeMes(Number(parts[0]))} ${parts[1]}`
        : mesAno
      groups.push({ label, mesAno, parcelas: sorted, totalPendente })
    }
    // Sort descending by mesAnoKey
    groups.sort((a,b) => (keyMap.get(b.mesAno) ?? 0) - (keyMap.get(a.mesAno) ?? 0))
    return groups
  }

  const groups = useMemo(() => {
    if (!socio) return []
    return groupByMonth(flattenParcelas(socio.vendas))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socio])

  const toggleGroup = (mesAno: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(mesAno)) next.delete(mesAno)
      else next.add(mesAno)
      return next
    })
  }

  const totalPendente = groups.reduce((s,g) => s + g.totalPendente, 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    )
  }

  if (!socio) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-gray-500">Erro ao carregar dados</p></div>
  }

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Cabeçalho */}
      <div>
        <p className="text-gray-500 text-sm">Histórico completo</p>
        <h1 className="text-xl font-bold text-gray-800">Extrato</h1>
      </div>

      {/* Resumo geral */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Total pendente</p>
            <p className="text-2xl font-bold">{formatBRL(totalPendente)}</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-100 text-xs">{groups.length} meses</p>
            <p className="text-white font-semibold text-sm">
              {groups.reduce((s,g) => s + g.parcelas.length, 0)} parcelas
            </p>
          </div>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-700 font-semibold">Nenhum registro encontrado</p>
          <p className="text-gray-400 text-sm mt-1">Não há parcelas no histórico</p>
        </div>
      )}

      {/* Grupos por mês */}
      {groups.map(group => {
        const isOpen = expandedGroups.has(group.mesAno)
        const pendentes = group.parcelas.filter(p => p.baixa !== 'S')
        const pagas = group.parcelas.filter(p => p.baixa === 'S')

        return (
          <div key={group.mesAno} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Cabeçalho do grupo */}
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors"
              onClick={() => toggleGroup(group.mesAno)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${group.totalPendente > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  {group.totalPendente > 0 ? (
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-gray-800 font-semibold text-sm">{group.label}</p>
                  <p className="text-gray-400 text-xs">
                    {pendentes.length > 0 && `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`}
                    {pendentes.length > 0 && pagas.length > 0 && ' · '}
                    {pagas.length > 0 && `${pagas.length} paga${pagas.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  {group.totalPendente > 0 ? (
                    <p className="text-amber-600 font-bold text-sm">{formatBRL(group.totalPendente)}</p>
                  ) : (
                    <p className="text-emerald-600 font-semibold text-sm">Quitado</p>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Parcelas do grupo */}
            {isOpen && (
              <div className="divide-y divide-gray-50 border-t border-gray-100">
                {group.parcelas.map(item => {
                  const paga = item.baixa === 'S'
                  const hoje = new Date(); hoje.setHours(0,0,0,0)
                  const venc = item.dataVencimento ? new Date(item.dataVencimento.slice(0,10) + 'T12:00:00') : null
                  const vencida = !paga && venc && venc < hoje

                  return (
                    <Link key={item.parcelaId} href={`/portal/emprestimos/${item.vendaId}`}>
                      <div className={`flex items-center justify-between px-4 py-3 transition-colors active:bg-gray-50 ${paga ? 'opacity-60' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${paga ? 'bg-emerald-100' : vencida ? 'bg-red-100' : 'bg-blue-50'}`}>
                            <span className={`text-[10px] font-bold ${paga ? 'text-emerald-700' : vencida ? 'text-red-600' : 'text-blue-600'}`}>
                              {item.numeroParcela}
                            </span>
                          </div>
                          <div>
                            <p className="text-gray-700 text-xs font-medium truncate max-w-[160px]">{item.convenio}</p>
                            <p className="text-gray-400 text-[11px]">
                              {item.numeroParcela}/{item.totalParcelas} · vence {formatDate(item.dataVencimento)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          {paga ? (
                            <>
                              <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Pago</span>
                              {item.valorPago != null && (
                                <p className="text-emerald-600 text-xs mt-0.5 line-through text-right">{formatBRL(item.valor)}</p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className={`font-semibold text-xs ${vencida ? 'text-red-600' : 'text-gray-800'}`}>
                                {formatBRL(item.valor)}
                              </p>
                              {vencida && <p className="text-red-500 text-[10px]">Vencida</p>}
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

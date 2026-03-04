'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface Parcela {
  id: string
  numeroParcela: number
  dataVencimento: string | null
  valor: number
  baixa: string | null
}

interface Venda {
  id: string
  numeroVenda: number
  quantidadeParcelas: number
  convenio: { razao_soc: string } | null
  parcelas: Parcela[]
}

interface Socio {
  nome: string
  empresa: { nome: string; diaCorte: number } | null
  vendas: Venda[]
}

interface Item {
  parcelaId: string
  vendaId: string
  numeroParcela: number
  totalParcelas: number
  convenio: string
  dataVencimento: string | null
  valor: number
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function nomeMes(mes: number) { return MESES[mes - 1] }

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function keyToLabel(key: number) {
  return `${nomeMes(key % 100)} / ${Math.floor(key / 100)}`
}

function keyToShort(key: number) {
  return `${String(key % 100).padStart(2,'0')}/${Math.floor(key / 100)}`
}

export default function DescontoPage() {
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)
  const [mesIdx, setMesIdx] = useState(0)

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then((data: Socio) => setSocio(data))
      .finally(() => setLoading(false))
  }, [])

  const { meses, itensPorMes } = useMemo(() => {
    if (!socio) return { meses: [] as number[], itensPorMes: new Map<number, Item[]>() }
    const map = new Map<number, Item[]>()
    for (const venda of socio.vendas) {
      const conv = venda.convenio?.razao_soc || `Empréstimo #${venda.numeroVenda}`
      for (const p of venda.parcelas) {
        if (p.baixa === 'S') continue
        if (!p.dataVencimento) continue
        const d = new Date(p.dataVencimento.slice(0,10) + 'T12:00:00')
        const key = d.getFullYear() * 100 + (d.getMonth() + 1)
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({
          parcelaId: p.id, vendaId: venda.id,
          numeroParcela: p.numeroParcela, totalParcelas: venda.quantidadeParcelas,
          convenio: conv, dataVencimento: p.dataVencimento, valor: p.valor,
        })
      }
    }
    const meses = [...map.keys()].sort((a, b) => a - b)
    return { meses, itensPorMes: map }
  }, [socio])

  useEffect(() => {
    if (meses.length === 0) return
    const d = new Date()
    const keyHoje = d.getFullYear() * 100 + (d.getMonth() + 1)
    let idx = meses.findIndex(k => k >= keyHoje)
    if (idx === -1) idx = meses.length - 1
    setMesIdx(idx)
  }, [meses])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">Carregando...</p>
    </div>
  )

  if (!socio) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-gray-500">Erro ao carregar dados</p>
    </div>
  )

  if (meses.length === 0) return (
    <div className="px-4 py-5">
        <p className="text-gray-500 text-sm">Descontos mensais</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p className="text-gray-700 font-semibold">Nenhuma cobrança</p>
        <p className="text-gray-400 text-sm mt-1">Não há parcelas pendentes</p>
      </div>
    </div>
  )

  const mesKey = meses[mesIdx]
  const itens = (itensPorMes.get(mesKey) ?? []).sort((a,b) => a.numeroParcela - b.numeroParcela)
  const total = itens.reduce((s,i) => s + Number(i.valor), 0)

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Descontos mensais</h1>
      </div>

      {/* Navegação mês a mês */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 py-3">
          <button
            onClick={() => setMesIdx(i => Math.max(0, i - 1))}
            disabled={mesIdx === 0}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="text-center">
            <p className="text-gray-800 font-semibold text-base leading-tight">{keyToLabel(mesKey)}</p>
            <p className="text-gray-400 text-xs">{keyToShort(mesKey)}</p>
          </div>
          <button
            onClick={() => setMesIdx(i => Math.min(meses.length - 1, i + 1))}
            disabled={mesIdx === meses.length - 1}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Faixa total */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4">
          <p className="text-emerald-100 text-[11px] font-semibold uppercase tracking-wider">Total do mês</p>
          <p className="text-3xl font-bold text-white mt-0.5">{formatBRL(total)}</p>
          <p className="text-emerald-100 text-xs mt-1">
            {itens.length} parcela{itens.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Lista de parcelas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        {itens.map(item => {
          const vencStr = item.dataVencimento
            ? new Date(item.dataVencimento.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR')
            : '—'
          return (
            <Link key={item.parcelaId} href={`/portal/compras/${item.vendaId}`}>
              <div className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-emerald-600">{item.numeroParcela}</span>
                  </div>
                  <div>
                    <p className="text-gray-800 text-sm font-medium leading-tight truncate max-w-[180px]">
                      {item.convenio}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Parcela {item.numeroParcela}/{item.totalParcelas} · {vencStr}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-sm text-gray-800 shrink-0 ml-2">{formatBRL(item.valor)}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Dots indicadores */}
      {meses.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {meses.map((_, i) => (
            <button key={i} onClick={() => setMesIdx(i)}
              className={`rounded-full transition-all ${i === mesIdx ? 'w-5 h-1.5 bg-emerald-500' : 'w-1.5 h-1.5 bg-gray-300'}`}
            />
          ))}
        </div>
      )}

    </div>
  )
}

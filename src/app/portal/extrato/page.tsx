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

interface Grupo {
  key: number
  label: string
  itens: Item[]
  total: number
}

function nomeMes(mes: number) {
  const nomes = ['Janeiro','Fevereiro','Mar\u00e7o','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return nomes[mes - 1]
}

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

export default function ExtratoPage() {
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then((data: Socio) => setSocio(data))
      .finally(() => setLoading(false))
  }, [])

  const grupos = useMemo((): Grupo[] => {
    if (!socio) return []
    const map = new Map<number, Item[]>()
    for (const venda of socio.vendas) {
      const conv = venda.convenio?.razao_soc || `Empr\u00e9stimo #${venda.numeroVenda}`
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
    return [...map.entries()]
      .sort((a,b) => b[0] - a[0])
      .map(([key, itens]) => {
        const mes = key % 100
        const ano = Math.floor(key / 100)
        const sorted = [...itens].sort((a,b) => a.numeroParcela - b.numeroParcela)
        return {
          key,
          label: `${nomeMes(mes)} / ${ano}`,
          itens: sorted,
          total: sorted.reduce((s,i) => s + Number(i.valor), 0),
        }
      })
  }, [socio])

  const totalGeral = grupos.reduce((s,g) => s + g.total, 0)

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

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <p className="text-gray-500 text-sm">Hist\u00f3rico</p>
        <h1 className="text-xl font-bold text-gray-800">Extrato</h1>
      </div>

      {/* Card resumo geral */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-[11px] font-semibold uppercase tracking-wider">Total pendente</p>
            <p className="text-2xl font-bold mt-0.5">{formatBRL(totalGeral)}</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-100 text-xs">{grupos.length} meses</p>
            <p className="text-white font-semibold text-sm">
              {grupos.reduce((s,g) => s + g.itens.length, 0)} parcelas
            </p>
          </div>
        </div>
      </div>

      {grupos.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-700 font-semibold">Nenhum registro</p>
          <p className="text-gray-400 text-sm mt-1">N\u00e3o h\u00e1 parcelas pendentes</p>
        </div>
      )}

      {/* Grupos por m\u00eas */}
      {grupos.map(grupo => (
        <div key={grupo.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Cabe\u00e7alho do m\u00eas */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
            <div>
              <p className="text-gray-800 font-semibold text-sm">{grupo.label}</p>
              <p className="text-gray-400 text-xs">{grupo.itens.length} parcela{grupo.itens.length !== 1 ? 's' : ''}</p>
            </div>
            <p className="text-emerald-600 font-bold text-sm">{formatBRL(grupo.total)}</p>
          </div>

          {/* Parcelas do m\u00eas */}
          <div className="divide-y divide-gray-50">
            {grupo.itens.map(item => {
              const vencStr = item.dataVencimento
                ? new Date(item.dataVencimento.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR')
                : '\u2014'
              return (
                <Link key={item.parcelaId} href={`/portal/emprestimos/${item.vendaId}`}>
                  <div className="flex items-center justify-between px-4 py-3 active:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-emerald-600">{item.numeroParcela}</span>
                      </div>
                      <div>
                        <p className="text-gray-700 text-xs font-medium truncate max-w-[175px]">{item.convenio}</p>
                        <p className="text-gray-400 text-[11px]">
                          {item.numeroParcela}/{item.totalParcelas} \u00b7 {vencStr}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-xs text-gray-800 shrink-0 ml-2">{formatBRL(item.valor)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

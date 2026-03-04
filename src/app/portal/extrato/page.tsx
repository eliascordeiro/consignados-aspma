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
  valorTotal: number
  valorParcela: number
  dataEmissao: string
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
        <h1 className="text-xl font-bold text-gray-800">Extrato</h1>
      </div>

      {/* Card resumo geral */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-[11px] font-semibold uppercase tracking-wider">Total em aberto</p>
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
          <p className="text-gray-400 text-sm mt-1">N\u00e3o h\u00e1 parcelas em aberto</p>
        </div>
      )}

      {/* Compras */}
      {socio.vendas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-gray-800 font-semibold text-sm uppercase tracking-wider">Compras</h2>

          {/* Card resumo compras */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-[11px] font-semibold uppercase tracking-wider">Total em compras</p>
                <p className="text-2xl font-bold mt-0.5">{formatBRL(socio.vendas.reduce((s,v) => s + Number(v.valorTotal), 0))}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-100 text-xs">Desconto mensal</p>
                <p className="text-white font-bold text-lg">{formatBRL(socio.vendas.reduce((s,v) => s + Number(v.valorParcela), 0))}</p>
              </div>
            </div>
          </div>

          {socio.vendas.map((venda, idx) => {
            const total = venda.parcelas.length || venda.quantidadeParcelas
            const pagas = venda.parcelas.filter(p => p.baixa === 'S').length
            const fmtMA = (iso: string) => {
              const d = new Date(iso.slice(0, 10) + 'T12:00:00')
              return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            }
            const datas = venda.parcelas
              .filter(p => p.dataVencimento)
              .map(p => p.dataVencimento!)
              .sort()
            const inicio = datas.length > 0 ? fmtMA(datas[0]) : null
            const fim    = datas.length > 0 ? fmtMA(datas[datas.length - 1]) : null
            const emissao = new Date(venda.dataEmissao.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')
            const quitado = pagas === total && total > 0

            const cores = [
              'bg-emerald-100 text-emerald-700',
              'bg-teal-100 text-teal-700',
              'bg-cyan-100 text-cyan-700',
              'bg-sky-100 text-sky-700',
            ]
            const cor = cores[idx % cores.length]
            const inicial = (venda.convenio?.razao_soc || `V${venda.numeroVenda}`).charAt(0).toUpperCase()

            return (
              <Link key={venda.id} href={`/portal/emprestimos/${venda.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-base ${cor}`}>
                      {inicial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-semibold text-sm leading-tight truncate">
                        {venda.convenio?.razao_soc || `Venda #${venda.numeroVenda}`}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">Compra em {emissao}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      quitado ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {quitado ? 'Quitado' : 'Ativo'}
                    </span>
                  </div>

                  <div className="mx-4 border-t border-gray-50" />

                  <div className="grid grid-cols-3 divide-x divide-gray-50 px-0 py-3">
                    <div className="text-center px-2">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide">Parcelas</p>
                      <p className="text-gray-800 font-bold text-sm mt-0.5">{total}</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide">Total</p>
                      <p className="text-gray-800 font-bold text-sm mt-0.5">{formatBRL(venda.valorTotal)}</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide">Por parcela</p>
                      <p className="text-emerald-600 font-bold text-sm mt-0.5">{formatBRL(venda.valorParcela)}</p>
                    </div>
                  </div>

                  {(inicio || fim) && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/60">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-500 text-xs">{inicio} → {fim}</p>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-600">
                        <p className="text-xs font-medium">Detalhes</p>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
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

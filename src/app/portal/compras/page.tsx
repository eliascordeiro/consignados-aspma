'use client'

import { useEffect, useState } from 'react'
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
  dataEmissao: string
  quantidadeParcelas: number
  valorParcela: number
  valorTotal: number
  convenio: { razao_soc: string; codigo: string } | null
  parcelas: Parcela[]
}

interface Socio {
  vendas: Venda[]
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}

function fmtMesAno(iso: string) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function ComprasPage() {
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then(data => setSocio(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    )
  }

  const vendas = socio?.vendas ?? []
  const totalGeral = vendas.reduce((s, v) => s + Number(v.valorTotal), 0)

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Minhas Compras</h1>
        <p className="text-gray-400 text-sm mt-0.5">{vendas.length} compra{vendas.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Card resumo */}
      {vendas.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md">
          <div>
            <p className="text-emerald-100 text-[11px] font-semibold uppercase tracking-wider">Total em compras</p>
            <p className="text-2xl font-bold mt-0.5">{formatBRL(totalGeral)}</p>
          </div>
        </div>
      )}

      {/* Lista */}
      {vendas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold">Nenhuma compra</p>
          <p className="text-gray-400 text-sm mt-1">Não há compras ativas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendas.map((venda, idx) => {
            const total = venda.parcelas.length || venda.quantidadeParcelas
            const pagas = venda.parcelas.filter(p => p.baixa === 'S').length
            const datas = venda.parcelas
              .filter(p => p.dataVencimento)
              .map(p => p.dataVencimento!)
              .sort()
            const inicio = datas.length > 0 ? fmtMesAno(datas[0]) : null
            const fim    = datas.length > 0 ? fmtMesAno(datas[datas.length - 1]) : null
            const emissao = new Date(venda.dataEmissao.slice(0, 10) + 'T12:00:00')
              .toLocaleDateString('pt-BR')
            const quitado = pagas === total && total > 0

            // Cores do avatar por índice
            const cores = [
              'bg-emerald-100 text-emerald-700',
              'bg-teal-100 text-teal-700',
              'bg-cyan-100 text-cyan-700',
              'bg-sky-100 text-sky-700',
            ]
            const cor = cores[idx % cores.length]
            const inicial = (venda.convenio?.razao_soc || `V${venda.numeroVenda}`).charAt(0).toUpperCase()

            return (
              <Link key={venda.id} href={`/portal/compras/${venda.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-transform">
                  {/* Topo colorido */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-base ${cor}`}>
                      {inicial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-semibold text-sm leading-tight truncate">
                        {venda.convenio?.razao_soc || `Venda #${venda.numeroVenda}`}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">Compra em {emissao}</p>
                    </div>

                  </div>

                  {/* Linha divisória */}
                  <div className="mx-4 border-t border-gray-50" />

                  {/* Grid de dados */}
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

                  {/* Período */}
                  {(inicio || fim) && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/60">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-500 text-xs">{inicio} → {fim}</p>
                      </div>

                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

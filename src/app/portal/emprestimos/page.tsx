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

export default function EmprestimosPage() {
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

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Compras</h1>
        <p className="text-gray-400 text-sm mt-0.5">{vendas.length} compra{vendas.length !== 1 ? 's' : ''} ativa{vendas.length !== 1 ? 's' : ''}</p>
      </div>

      {vendas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-700 font-semibold">Nenhuma compra</p>
          <p className="text-gray-400 text-sm mt-1">Não há compras ativas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendas.map(venda => {
            const total = venda.parcelas.length || venda.quantidadeParcelas
            const datas = venda.parcelas
              .filter(p => p.dataVencimento)
              .map(p => p.dataVencimento!)
              .sort()
            const inicio = datas.length > 0 ? fmtMesAno(datas[0]) : null
            const fim    = datas.length > 0 ? fmtMesAno(datas[datas.length - 1]) : null
            const emissao = new Date(venda.dataEmissao.slice(0, 10) + 'T12:00:00')
              .toLocaleDateString('pt-BR')

            return (
              <Link key={venda.id} href={`/portal/emprestimos/${venda.id}`}>
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-medium text-sm truncate">
                        {venda.convenio?.razao_soc || `Venda #${venda.numeroVenda}`}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {total} parcela{total !== 1 ? 's' : ''}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Compra: {emissao}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-gray-800 font-semibold text-sm">{formatBRL(venda.valorTotal)}</p>
                      <p className="text-gray-400 text-xs">{formatBRL(venda.valorParcela)}/parcela</p>
                      {inicio && <p className="text-gray-400 text-xs mt-0.5">De {inicio}</p>}
                      {fim    && <p className="text-gray-400 text-xs">Até {fim}</p>}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

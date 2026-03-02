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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function StatusChip({ pagas, total }: { pagas: number; total: number }) {
  if (pagas === total && total > 0) {
    return <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">Quitado</span>
  }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Em curso</span>
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
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Meus Empréstimos</h1>
      <p className="text-gray-400 text-sm mb-5">{vendas.length} contrato{vendas.length !== 1 ? 's' : ''} encontrado{vendas.length !== 1 ? 's' : ''}</p>

      {vendas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm text-center">Nenhum empréstimo encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vendas.map(venda => {
            const pagas = venda.parcelas.filter(p => p.baixa === 'S').length
            const total = venda.parcelas.length || venda.quantidadeParcelas
            const pct = total > 0 ? Math.round((pagas / total) * 100) : 0
            const abertas = venda.parcelas.filter(p => p.baixa !== 'S')
            const totalAberto = abertas.reduce((s, p) => s + Number(p.valor), 0)

            return (
              <Link key={venda.id} href={`/portal/emprestimos/${venda.id}`}>
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-semibold text-base leading-tight truncate">
                        {venda.convenio?.razao_soc || `Empréstimo #${venda.numeroVenda}`}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">Emitido em {formatDate(venda.dataEmissao)}</p>
                    </div>
                    <StatusChip pagas={pagas} total={total} />
                  </div>

                  {/* Valores */}
                  <div className="grid grid-cols-3 gap-2 mb-3 bg-gray-50 rounded-xl p-3">
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Parcela</p>
                      <p className="text-gray-800 font-semibold text-sm">{formatBRL(venda.valorParcela)}</p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="text-gray-400 text-xs">Total</p>
                      <p className="text-gray-800 font-semibold text-sm">{formatBRL(venda.valorTotal)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Em aberto</p>
                      <p className={`font-semibold text-sm ${totalAberto > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                        {formatBRL(totalAberto)}
                      </p>
                    </div>
                  </div>

                  {/* Progresso */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">{pagas} de {total} parcelas pagas</span>
                      <span className="text-emerald-600 font-semibold">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Seta */}
                  <div className="flex items-center justify-end mt-2">
                    <span className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                      Ver detalhes
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
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

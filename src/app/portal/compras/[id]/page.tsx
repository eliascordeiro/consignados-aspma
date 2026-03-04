'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  dataEmissao: string
  quantidadeParcelas: number
  valorParcela: number
  valorTotal: number
  convenio: { razao_soc: string; codigo: string } | null
  parcelas: Parcela[]
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function ParcelaStatus({ parcela }: { parcela: Parcela }) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (parcela.baixa === 'S') {
    return (
      <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full whitespace-nowrap">
        Pago
      </span>
    )
  }
  if (parcela.dataVencimento && new Date(parcela.dataVencimento) < hoje) {
    return (
      <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full whitespace-nowrap">
        Vencida
      </span>
    )
  }
  return (
    <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
      A vencer
    </span>
  )
}

export default function EmprestimoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [venda, setVenda] = useState<Venda | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then(data => {
        if (!data.vendas) { setNotFound(true); return }
        const found = data.vendas.find((v: Venda) => v.id === params.id)
        if (!found) setNotFound(true)
        else setVenda(found)
      })
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    )
  }

  if (notFound || !venda) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
        <p className="text-gray-600 font-medium">Empréstimo não encontrado</p>
        <Link href="/portal/compras" className="text-emerald-600 text-sm font-medium">
          ← Voltar para compras
        </Link>
      </div>
    )
  }

  const pagas = venda.parcelas.filter(p => p.baixa === 'S').length
  const total = venda.parcelas.length || venda.quantidadeParcelas
  const pct = total > 0 ? Math.round((pagas / total) * 100) : 0
  const abertas = venda.parcelas.filter(p => p.baixa !== 'S')
  const totalAberto = abertas.reduce((s, p) => s + Number(p.valor), 0)

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      {/* Header do contrato */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-md">
        <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider mb-1">
          {venda.convenio?.razao_soc || 'Contrato'}
        </p>
        <p className="text-2xl font-bold">{formatBRL(venda.valorParcela)}<span className="text-emerald-200 text-base font-normal">/mês</span></p>
        <p className="text-emerald-100 text-sm mt-1">{venda.quantidadeParcelas}x de {formatBRL(venda.valorParcela)}</p>
        <p className="text-emerald-200 text-xs mt-1">Emitido em {formatDate(venda.dataEmissao)}</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: formatBRL(venda.valorTotal), color: 'text-gray-800' },
          { label: 'Pagas', value: `${pagas}/${total}`, color: 'text-emerald-600' },
          { label: 'Em aberto', value: formatBRL(totalAberto), color: totalAberto > 0 ? 'text-orange-600' : 'text-emerald-600' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-gray-400 text-xs">{item.label}</p>
            <p className={`font-bold text-sm mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progresso */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600 font-medium">Progresso</span>
          <span className="text-emerald-600 font-bold">{pct}% quitado</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Lista de parcelas */}
      <div>
        <h2 className="text-gray-800 font-semibold text-sm uppercase tracking-wider mb-3">Parcelas</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {venda.parcelas.map(parcela => (
            <div key={parcela.id} className={`flex items-center justify-between px-4 py-3.5 ${parcela.baixa === 'S' ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                {/* Ícone */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  parcela.baixa === 'S' ? 'bg-emerald-100' :
                  (parcela.dataVencimento && new Date(parcela.dataVencimento) < new Date()) ? 'bg-red-100' : 'bg-blue-50'
                }`}>
                  {parcela.baixa === 'S' ? (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className={`text-xs font-bold ${
                      parcela.dataVencimento && new Date(parcela.dataVencimento) < new Date() ? 'text-red-600' : 'text-blue-600'
                    }`}>{parcela.numeroParcela}</span>
                  )}
                </div>

                <div>
                  <p className="text-gray-800 text-sm font-medium">
                    Parcela {parcela.numeroParcela}/{total}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {parcela.baixa === 'S' ? `Pago em ${formatDate(parcela.dataBaixa)}` : `Vence em ${formatDate(parcela.dataVencimento)}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-gray-800 font-semibold text-sm">{formatBRL(parcela.valorPago ?? parcela.valor)}</span>
                <ParcelaStatus parcela={parcela} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
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

interface Socio {
  id: string
  nome: string
  matricula: string | null
  limite: number | null
  margemConsig: number | null
  bloqueio: string | null
  empresa: { nome: string } | null
  vendas: Venda[]
}

function formatBRL(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function formatDate(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

export default function PortalDashboardPage() {
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then(data => {
        if (data.error) setErro(data.error)
        else setSocio(data)
      })
      .catch(() => setErro('Erro ao carregar dados'))
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

  if (erro || !socio) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-3">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium">Erro ao carregar</p>
        <p className="text-gray-500 text-sm">{erro}</p>
      </div>
    )
  }

  // Calcular resumo das parcelas
  const todasParcelas = socio.vendas.flatMap(v => v.parcelas)
  const parcelasAberto = todasParcelas.filter(p => p.baixa !== 'S')
  const totalAberto = parcelasAberto.reduce((sum, p) => sum + Number(p.valor), 0)

  // Próximo vencimento
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const proximasParcelas = parcelasAberto
    .filter(p => p.dataVencimento)
    .sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())
  const proxParcela = proximasParcelas[0]

  // Parcelas vencidas
  const vencidas = parcelasAberto.filter(p => p.dataVencimento && new Date(p.dataVencimento) < hoje)
  const totalVencido = vencidas.reduce((sum, p) => sum + Number(p.valor), 0)

  // Margem disponível = limite cadastrado − total em aberto das parcelas ativas
  const margem = Math.max(0, Number(socio.limite || 0) - totalAberto)

  const primeiroNome = socio.nome.split(' ')[0]

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Saudação */}
      <div>
        <p className="text-gray-500 text-sm">Olá,</p>
        <h1 className="text-xl font-bold text-gray-800">{primeiroNome} 👋</h1>
        {socio.matricula && (
          <p className="text-gray-400 text-xs mt-0.5">Matrícula: {socio.matricula}</p>
        )}
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-3">
        {/* Margem disponível */}
        <div className="col-span-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md">
          <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Margem Disponível</p>
          <p className="text-3xl font-bold mt-1">{formatBRL(margem)}</p>
          <p className="text-emerald-200 text-xs mt-1">
            Limite: {formatBRL(socio.limite)} · Em aberto: {formatBRL(totalAberto)}
          </p>
        </div>

        {/* Próximo vencimento */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Próx. Vencimento</p>
          {proxParcela ? (
            <>
              <p className="text-lg font-bold text-gray-800 mt-1">{formatDate(proxParcela.dataVencimento)}</p>
              <p className="text-emerald-600 text-sm font-semibold">{formatBRL(proxParcela.valor)}</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm mt-1">Nenhuma</p>
          )}
        </div>

        {/* Total em aberto */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Em Aberto</p>
          <p className="text-lg font-bold text-gray-800 mt-1">{formatBRL(totalAberto)}</p>
          <p className="text-gray-400 text-xs">{parcelasAberto.length} parcela{parcelasAberto.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Alerta de parcelas vencidas */}
      {vencidas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-red-800 text-sm font-semibold">
                {vencidas.length} parcela{vencidas.length !== 1 ? 's' : ''} vencida{vencidas.length !== 1 ? 's' : ''}
              </p>
              <p className="text-red-600 text-xs">{formatBRL(totalVencido)} em atraso</p>
            </div>
          </div>
        </div>
      )}

      {/* Empréstimos ativos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-800 font-semibold text-sm uppercase tracking-wider">Meus Empréstimos</h2>
          <Link href="/portal/emprestimos" className="text-emerald-600 text-sm font-medium">
            Ver todos
          </Link>
        </div>

        {socio.vendas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
            <p className="text-gray-400 text-sm">Nenhum empréstimo ativo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {socio.vendas.slice(0, 3).map(venda => {
              const pagas = venda.parcelas.filter(p => p.baixa === 'S').length
              const total = venda.parcelas.length || venda.quantidadeParcelas
              const pct = total > 0 ? Math.round((pagas / total) * 100) : 0

              return (
                <Link key={venda.id} href={`/portal/emprestimos/${venda.id}`}>
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 font-medium text-sm truncate">
                          {venda.convenio?.razao_soc || `Venda #${venda.numeroVenda}`}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {pagas}/{total} parcelas pagas
                        </p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-gray-800 font-semibold text-sm">{formatBRL(venda.valorParcela)}<span className="text-gray-400 font-normal">/mês</span></p>
                        <p className="text-gray-400 text-xs">{formatBRL(venda.valorTotal)} total</p>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Progresso</span>
                        <span className="text-emerald-600 font-medium">{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

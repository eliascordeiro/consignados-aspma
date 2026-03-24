'use client'

import { useEffect, useMemo, useState } from 'react'
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
  tipo: string | null
  codTipo: number | null
  empresa: { nome: string; diaCorte: number | null } | null
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
  const [mesNavIdx, setMesNavIdx] = useState(-1)
  const [margemZetra, setMargemZetra] = useState<number | null>(null)
  const [loadingMargem, setLoadingMargem] = useState(false)
  const [fonteMargem, setFonteMargem] = useState<string>('')

  // Mapa mês → parcelas em aberto (mesmo padrão do fatura page)
  const mesesMap = useMemo(() => {
    if (!socio) return new Map<number, Parcela[]>()
    const map = new Map<number, Parcela[]>()
    for (const venda of socio.vendas) {
      for (const p of venda.parcelas) {
        if (p.baixa === 'S' || !p.dataVencimento) continue
        const d = new Date(p.dataVencimento.slice(0, 10) + 'T12:00:00')
        const key = d.getFullYear() * 100 + (d.getMonth() + 1)
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(p)
      }
    }
    return map
  }, [socio])

  const mesesKeys = useMemo(() => [...mesesMap.keys()].sort((a, b) => a - b), [mesesMap])

  // Mês inicial = mês atual
  useEffect(() => {
    if (mesesKeys.length === 0) return
    const now = new Date()
    const targetKey = now.getFullYear() * 100 + (now.getMonth() + 1)
    let idx = mesesKeys.findIndex(k => k >= targetKey)
    if (idx === -1) idx = mesesKeys.length - 1
    setMesNavIdx(idx)
  }, [mesesKeys])

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then(data => {
        if (data.error) setErro(data.error)
        else {
          setSocio(data)
          // busca margem Zetra — tipo != '3' e != '4' = ZETRA (campo tipo é String)
          const isZetra = data.tipo !== '3' && data.tipo !== '4'
          if (isZetra) {
            setLoadingMargem(true)
            fetch('/api/portal/margem')
              .then(r => r.json())
              .then(m => {
                if (m.margem != null) setMargemZetra(m.margem)
                setFonteMargem(m.fonte || '')
              })
              .catch(() => {})
              .finally(() => setLoadingMargem(false))
          }
        }
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



  // Mês de referência — mesma lógica do AS200.PRG IniciaDados()
  // se dia atual > diaCorte → referência é o próximo mês
  const diaCorte = socio.empresa?.diaCorte ?? 9
  const hojeRef = new Date()
  let refMes: number
  let refAno: number
  if (hojeRef.getDate() > diaCorte) {
    if (hojeRef.getMonth() === 11) { refMes = 1; refAno = hojeRef.getFullYear() + 1 }
    else { refMes = hojeRef.getMonth() + 2; refAno = hojeRef.getFullYear() }
  } else {
    refMes = hojeRef.getMonth() + 1
    refAno = hojeRef.getFullYear()
  }

  // Margem disponível — igual ao AS200.PRG
  // tipo 3/4 (local): limite − SUM(parcelas do mês de referência com baixa != 'S')
  // tipo != 3/4 (ZETRA): usa margem via API Zetra
  const isLocal = socio.tipo === '3' || socio.tipo === '4'
  const refKey = refAno * 100 + refMes   // mesmo padrão de chave do fatura page

  // SUM parcelas do mês de referência (mesmo filtro do fatura page por key)
  const parcelasMesRef = isLocal ? todasParcelas.filter(p => {
    if (p.baixa === 'S') return false
    if (!p.dataVencimento) return false
    const d = new Date(p.dataVencimento.slice(0, 10) + 'T12:00:00')
    const key = d.getFullYear() * 100 + (d.getMonth() + 1)
    return key === refKey
  }) : []
  const totalMesRef = parcelasMesRef.reduce((sum, p) => sum + Number(p.valor), 0)

  const margem = isLocal
    ? Math.max(0, Number(socio.limite || 0) - totalMesRef)
    : (margemZetra ?? Number(socio.margemConsig || 0))

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Margem disponível */}
        <div className="col-span-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md lg:col-span-2">
          <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Margem Disponível</p>
          <p className="text-3xl font-bold mt-1">
            {loadingMargem
              ? <span className="inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin align-middle" />
              : formatBRL(margem)}
          </p>
          <p className="text-emerald-200 text-xs mt-1">
            {isLocal
              ? `${String(refMes).padStart(2,'0')}/${refAno} · Comprometido: ${formatBRL(totalMesRef)} de ${formatBRL(socio.limite)}`
              : loadingMargem ? 'Consultando ZETRA...' : fonteMargem === 'zetra' ? 'Margem via ZETRA (tempo real)' : fonteMargem === 'fallback' ? 'Margem via ZETRA (fallback banco)' : fonteMargem === 'zetra_erro' ? 'Margem via ZETRA (erro — valor banco)' : 'Margem via convênio (ZETRA)'}
          </p>
        </div>

        {/* Vencimentos por mês — mini navegador */}
        {(() => {
          const navKey = mesesKeys[mesNavIdx] ?? 0
          // col-span-2 pois é o único card pequeno
          const navParcelas = mesesMap.get(navKey) ?? []
          const navTotal = navParcelas.reduce((s, p) => s + Number(p.valor), 0)
          const navMes = navKey % 100
          const navAno = Math.floor(navKey / 100)
          return (
            <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 lg:col-span-2">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Vencimentos</p>
              {mesesKeys.length > 0 && mesNavIdx >= 0 ? (
                <>
                  <div className="flex items-center justify-between mt-1.5">
                    <button
                      onClick={() => setMesNavIdx(i => Math.max(0, i - 1))}
                      disabled={mesNavIdx === 0}
                      className="text-gray-400 disabled:opacity-25 text-xl leading-none px-0.5 active:scale-90"
                    >&#8249;</button>
                    <p className="text-xs font-semibold text-gray-700">
                      {String(navMes).padStart(2, '0')}/{navAno}
                    </p>
                    <button
                      onClick={() => setMesNavIdx(i => Math.min(mesesKeys.length - 1, i + 1))}
                      disabled={mesNavIdx === mesesKeys.length - 1}
                      className="text-gray-400 disabled:opacity-25 text-xl leading-none px-0.5 active:scale-90"
                    >&#8250;</button>
                  </div>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">{formatBRL(navTotal)}</p>
                  <p className="text-gray-400 text-xs">{navParcelas.length} parcela{navParcelas.length !== 1 ? 's' : ''}</p>
                  <Link href="/portal/desconto" className="text-emerald-600 text-xs font-medium mt-2 inline-block">
                    Ver detalhes em Descontos →
                  </Link>
                </>
              ) : (
                <p className="text-gray-500 text-sm mt-1">Nenhuma</p>
              )}
            </div>
          )
        })()}

      </div>

      {/* Últimas Compras */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-800 font-semibold text-sm uppercase tracking-wider">Últimas Compras</h2>
          <Link href="/portal/compras" className="text-emerald-600 text-sm font-medium">
            Ver todos
          </Link>
        </div>

        {socio.vendas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
            <p className="text-gray-400 text-sm">Nenhuma compra ativa</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {socio.vendas.slice(0, 3).map(venda => {
              const total = venda.parcelas.length || venda.quantidadeParcelas

              const datas = venda.parcelas
                .filter(p => p.dataVencimento)
                .map(p => p.dataVencimento!)
                .sort()
              const fmtMesAno = (iso: string) => {
                const d = new Date(iso.slice(0, 10) + 'T12:00:00')
                return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
              }
              const inicio = datas.length > 0 ? fmtMesAno(datas[0]) : null
              const fim = datas.length > 0 ? fmtMesAno(datas[datas.length - 1]) : null

              return (
                <Link key={venda.id} href={`/portal/compras/${venda.id}`}>
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
                          Compra: {new Date(venda.dataEmissao.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-gray-800 font-semibold text-sm">{formatBRL(venda.valorTotal)}</p>
                        <p className="text-gray-400 text-xs">{formatBRL(venda.valorParcela)}/parcela</p>
                        {inicio && <p className="text-gray-400 text-xs mt-0.5">De {inicio}</p>}
                        {fim && <p className="text-gray-400 text-xs">Até {fim}</p>}
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

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
  quantidadeParcelas: number
  valorParcela: number
  convenio: { razao_soc: string; codigo: string } | null
  parcelas: Parcela[]
}

interface Socio {
  nome: string
  bloqueio: string | null
  empresa: { nome: string; diaCorte: number } | null
  vendas: Venda[]
}

function calcularDataCorte(diaCorte = 9): { mes: number; ano: number } {
  const hoje = new Date()
  const dia = hoje.getDate()
  let mes = hoje.getMonth() + 1
  let ano = hoje.getFullYear()
  if (dia > diaCorte) {
    if (mes === 12) { mes = 1; ano += 1 } else { mes += 1 }
  }
  return { mes, ano }
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
  const s = d.slice(0, 10) + 'T12:00:00'
  return new Date(s).toLocaleDateString('pt-BR')
}

interface ParcelaItemProps {
  parcela: Parcela
  totalParcelas: number
  convenio: string
  vendaId: string
}
function ParcelaItem({ parcela, totalParcelas, convenio, vendaId }: ParcelaItemProps) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const venc = parcela.dataVencimento ? new Date(parcela.dataVencimento.slice(0,10) + 'T12:00:00') : null
  const vencida = venc && venc < hoje

  return (
    <Link href={`/portal/emprestimos/${vendaId}`}>
      <div className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${vencida ? 'bg-red-100' : 'bg-blue-50'}`}>
            <span className={`text-xs font-bold ${vencida ? 'text-red-600' : 'text-blue-600'}`}>
              {parcela.numeroParcela}
            </span>
          </div>
          <div>
            <p className="text-gray-800 text-sm font-medium leading-tight truncate max-w-[160px]">{convenio}</p>
            <p className="text-gray-400 text-xs">
              Parcela {parcela.numeroParcela}/{totalParcelas} · vence {formatDate(parcela.dataVencimento)}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className={`font-semibold text-sm ${vencida ? 'text-red-600' : 'text-gray-800'}`}>
            {formatBRL(parcela.valor)}
          </p>
          {vencida && <p className="text-red-500 text-xs">Vencida</p>}
        </div>
      </div>
    </Link>
  )
}

export default function FaturaPage() {
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

  if (!socio) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-gray-500">Erro ao carregar dados</p></div>
  }

  const diaCorte = socio.empresa?.diaCorte ?? 9
  const dataCorte = calcularDataCorte(diaCorte)

  // Todas as parcelas não baixadas de vendas ativas
  const todasParcelas: Array<ParcelaItemProps & { vencimento: Date | null }> = []
  for (const venda of socio.vendas) {
    const conv = venda.convenio?.razao_soc || `Empréstimo #${venda.numeroVenda}`
    for (const p of venda.parcelas) {
      if (p.baixa === 'S') continue // ignora baixadas
      const venc = p.dataVencimento ? new Date(p.dataVencimento.slice(0,10) + 'T12:00:00') : null
      todasParcelas.push({
        parcela: p,
        totalParcelas: venda.quantidadeParcelas,
        convenio: conv,
        vendaId: venda.id,
        vencimento: venc,
      })
    }
  }

  // Início do mês de referência
  const inicioMesRef = new Date(dataCorte.ano, dataCorte.mes - 1, 1)
  const fimMesRef    = new Date(dataCorte.ano, dataCorte.mes, 1)

  // Em atraso: vencimento < início do mês de referência, não baixada
  const emAtraso = todasParcelas
    .filter(item => item.vencimento && item.vencimento < inicioMesRef)
    .sort((a, b) => (a.vencimento!.getTime()) - (b.vencimento!.getTime()))

  // Fatura do mês: vencimento dentro do mês de referência, não baixada
  const doMes = todasParcelas
    .filter(item => item.vencimento && item.vencimento >= inicioMesRef && item.vencimento < fimMesRef)
    .sort((a, b) => (a.vencimento!.getTime()) - (b.vencimento!.getTime()))

  // A vencer (meses futuros): só mostra resumo
  const futuros = todasParcelas
    .filter(item => item.vencimento && item.vencimento >= fimMesRef)

  const totalAtraso = emAtraso.reduce((s, i) => s + Number(i.parcela.valor), 0)
  const totalMes    = doMes.reduce((s, i) => s + Number(i.parcela.valor), 0)
  const totalFatura = totalAtraso + totalMes

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Cabeçalho */}
      <div>
        <p className="text-gray-500 text-sm">Fatura do mês</p>
        <h1 className="text-xl font-bold text-gray-800">
          {nomeMes(dataCorte.mes)} / {dataCorte.ano}
        </h1>
        <p className="text-gray-400 text-xs mt-0.5">
          Dia de corte: {diaCorte} · {socio.empresa?.nome ?? 'Consignatária'}
        </p>
      </div>

      {/* Alerta de bloqueio */}
      {socio.bloqueio && socio.bloqueio !== 'N' && socio.bloqueio !== '' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div>
            <p className="text-red-800 text-sm font-semibold">Cadastro bloqueado</p>
            <p className="text-red-600 text-xs">Contate a associação para regularizar</p>
          </div>
        </div>
      )}

      {/* Card total */}
      <div className={`rounded-2xl p-5 text-white shadow-md ${totalFatura > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-gray-400 to-gray-500'}`}>
        <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Total da Fatura</p>
        <p className="text-3xl font-bold mt-1">{formatBRL(totalFatura)}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-emerald-100">{doMes.length} cobr. do mês</span>
          {emAtraso.length > 0 && (
            <span className="bg-red-400/40 text-white px-2 py-0.5 rounded-full text-xs font-medium">
              {emAtraso.length} em atraso
            </span>
          )}
        </div>
      </div>

      {/* Sem cobranças */}
      {totalFatura === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold">Tudo em dia!</p>
          <p className="text-gray-400 text-sm mt-1">Não há cobranças pendentes para este mês</p>
        </div>
      )}

      {/* Em atraso */}
      {emAtraso.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-red-600 font-semibold text-sm uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Em Atraso
            </h2>
            <span className="text-red-600 font-bold text-sm">{formatBRL(totalAtraso)}</span>
          </div>
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {emAtraso.map(item => (
              <ParcelaItem key={item.parcela.id} {...item} />
            ))}
          </div>
        </div>
      )}

      {/* Cobranças do mês */}
      {doMes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-gray-700 font-semibold text-sm uppercase tracking-wider">
              Cobranças — {nomeMes(dataCorte.mes)}
            </h2>
            <span className="text-gray-700 font-bold text-sm">{formatBRL(totalMes)}</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {doMes.map(item => (
              <ParcelaItem key={item.parcela.id} {...item} />
            ))}
          </div>
        </div>
      )}

      {/* A vencer (próximos meses) — só resumo */}
      {futuros.length > 0 && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Próximos meses</p>
          <p className="text-gray-700 text-sm">
            <span className="font-semibold">{futuros.length}</span> parcela{futuros.length !== 1 ? 's' : ''} a vencer ·{' '}
            <span className="font-semibold">{formatBRL(futuros.reduce((s,i) => s + Number(i.parcela.valor), 0))}</span>
          </p>
          <Link href="/portal/extrato" className="text-emerald-600 text-xs font-medium mt-1 inline-block">
            Ver extrato completo →
          </Link>
        </div>
      )}
    </div>
  )
}

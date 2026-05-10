"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  BarChart3,
  TrendingUp,
  Wallet,
  Calendar,
  History,
  Lock,
  Loader2,
  ShoppingBag,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

type Tab = "vendas" | "margem" | "parcelas" | "historico" | "bloqueados"

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "vendas", label: "Vendas por Período", icon: TrendingUp },
  { id: "margem", label: "Margem Disponível", icon: Wallet },
  { id: "parcelas", label: "Parcelas do Mês", icon: Calendar },
  { id: "historico", label: "Histórico de Margem", icon: History },
  { id: "bloqueados", label: "Sócios Bloqueados", icon: Lock },
]

export default function RelatoriosPage() {
  const [tab, setTab] = useState<Tab>("vendas")

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          Relatórios
        </h2>
        <p className="text-sm text-muted-foreground">
          Visualize vendas, margem, parcelas e histórico de alterações da sua consignatária.
        </p>
      </div>

      <div className="border-b flex flex-wrap gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "px-4 py-2 text-sm flex items-center gap-2 border-b-2 transition-colors -mb-px whitespace-nowrap " +
              (tab === t.id
                ? "border-violet-500 text-violet-700 dark:text-violet-300 font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted")
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "vendas" && <VendasTab />}
      {tab === "margem" && <MargemTab />}
      {tab === "parcelas" && <ParcelasTab />}
      {tab === "historico" && <HistoricoTab />}
      {tab === "bloqueados" && <BloqueadosTab />}
    </div>
  )
}

// ─── VENDAS ────────────────────────────────────────────────

function VendasTab() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const [inicio, setInicio] = useState(toISODate(firstDay))
  const [fim, setFim] = useState(toISODate(today))
  const [status, setStatus] = useState<"ativas" | "canceladas" | "todas">("ativas")
  const [filters, setFilters] = useState({ inicio, fim, status })

  const { data, isLoading } = useQuery<any>({
    queryKey: ["rel-vendas", filters],
    queryFn: async () => {
      const p = new URLSearchParams(filters as any)
      const r = await fetch(`/api/empresa/relatorios/vendas-periodo?${p}`)
      if (!r.ok) throw new Error("erro")
      return r.json()
    },
  })

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="block h-9 w-40 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="ativas">Ativas</option>
              <option value="canceladas">Canceladas</option>
              <option value="todas">Todas</option>
            </select>
          </div>
          <Button onClick={() => setFilters({ inicio, fim, status })} className="bg-violet-600 hover:bg-violet-700 text-white">
            Aplicar Filtro
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Loading />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard title="Vendas no Período" value={String(data.total)} icon={ShoppingBag} />
            <SummaryCard
              title="Valor Total"
              value={formatCurrency(data.totalValor)}
              icon={Wallet}
              highlight
            />
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Funcionário</th>
                  <th className="text-center p-3">Parcelas</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((v: any) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono">{v.numeroVenda}</td>
                    <td className="p-3">{new Date(v.dataEmissao).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">
                      <Link
                        href={`/empresa/funcionarios/${v.socio.id}`}
                        className="text-violet-700 dark:text-violet-300 hover:underline"
                      >
                        {v.socio.nome}
                      </Link>
                      {v.socio.matricula && (
                        <div className="text-xs text-muted-foreground">Mat. {v.socio.matricula}</div>
                      )}
                    </td>
                    <td className="p-3 text-center">{v.quantidadeParcelas}x</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(v.valorTotal)}</td>
                    <td className="p-3 text-center">
                      {v.cancelado ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400">
                          Cancelada
                        </span>
                      ) : v.ativo ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          Ativa
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Quitada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Empty />
      )}
    </>
  )
}

// ─── MARGEM ────────────────────────────────────────────────

function MargemTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["rel-margem"],
    queryFn: async () => {
      const r = await fetch("/api/empresa/relatorios/margem-disponivel")
      if (!r.ok) throw new Error("erro")
      return r.json()
    },
  })

  if (isLoading) return <Loading />
  if (!data || data.total === 0) return <Empty />

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Margem Total" value={formatCurrency(data.totais.margemTotal)} icon={Wallet} />
        <SummaryCard title="Consumida" value={formatCurrency(data.totais.consumido)} icon={TrendingUp} />
        <SummaryCard title="Disponível" value={formatCurrency(data.totais.disponivel)} icon={Wallet} highlight />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3">Funcionário</th>
              <th className="text-right p-3 hidden md:table-cell">Margem</th>
              <th className="text-right p-3 hidden md:table-cell">Consumido</th>
              <th className="text-right p-3">Disponível</th>
              <th className="text-left p-3 w-40">Uso</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((s: any) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <Link
                    href={`/empresa/funcionarios/${s.id}`}
                    className="text-violet-700 dark:text-violet-300 hover:underline"
                  >
                    {s.nome}
                  </Link>
                  {s.bloqueado && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">
                      Bloq.
                    </span>
                  )}
                  {s.matricula && (
                    <div className="text-xs text-muted-foreground">Mat. {s.matricula}</div>
                  )}
                </td>
                <td className="p-3 text-right hidden md:table-cell">{formatCurrency(s.margemTotal)}</td>
                <td className="p-3 text-right hidden md:table-cell">{formatCurrency(s.consumido)}</td>
                <td className="p-3 text-right font-medium text-violet-700 dark:text-violet-300">
                  {formatCurrency(s.disponivel)}
                </td>
                <td className="p-3">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={
                        "h-full " +
                        (s.pctConsumida >= 90
                          ? "bg-rose-500"
                          : s.pctConsumida >= 60
                          ? "bg-amber-500"
                          : "bg-violet-500")
                      }
                      style={{ width: `${s.pctConsumida}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.pctConsumida.toFixed(1)}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

// ─── PARCELAS ──────────────────────────────────────────────

function ParcelasTab() {
  const today = new Date()
  const [mes, setMes] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  )

  const { data, isLoading } = useQuery<any>({
    queryKey: ["rel-parcelas", mes],
    queryFn: async () => {
      const r = await fetch(`/api/empresa/relatorios/parcelas-pendentes?mes=${mes}`)
      if (!r.ok) throw new Error("erro")
      return r.json()
    },
  })

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Mês</label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Loading />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard title="Parcelas Pendentes" value={String(data.total)} icon={Calendar} />
            <SummaryCard
              title="Valor a Receber"
              value={formatCurrency(data.totalValor)}
              icon={Wallet}
              highlight
            />
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-left p-3">Funcionário</th>
                  <th className="text-left p-3 hidden md:table-cell">Venda</th>
                  <th className="text-center p-3">Parcela</th>
                  <th className="text-right p-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">{new Date(p.dataVencimento).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">
                      <Link
                        href={`/empresa/funcionarios/${p.venda.socio.id}`}
                        className="text-violet-700 dark:text-violet-300 hover:underline"
                      >
                        {p.venda.socio.nome}
                      </Link>
                    </td>
                    <td className="p-3 hidden md:table-cell font-mono">#{p.venda.numeroVenda}</td>
                    <td className="p-3 text-center">
                      {p.numeroParcela}/{p.venda.quantidadeParcelas}
                    </td>
                    <td className="p-3 text-right font-medium">{formatCurrency(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Empty text="Nenhuma parcela pendente neste mês." />
      )}
    </>
  )
}

// ─── HISTÓRICO MARGEM ──────────────────────────────────────

function HistoricoTab() {
  const today = new Date()
  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
  const [inicio, setInicio] = useState(toISODate(monthAgo))
  const [fim, setFim] = useState(toISODate(today))
  const [filters, setFilters] = useState({ inicio, fim })

  const { data, isLoading } = useQuery<any>({
    queryKey: ["rel-historico", filters],
    queryFn: async () => {
      const p = new URLSearchParams(filters as any)
      const r = await fetch(`/api/empresa/relatorios/historico-margem?${p}`)
      if (!r.ok) throw new Error("erro")
      return r.json()
    },
  })

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <Button onClick={() => setFilters({ inicio, fim })} className="bg-violet-600 hover:bg-violet-700 text-white">
            Aplicar
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Loading />
      ) : data && data.items.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Funcionário</th>
                <th className="text-left p-3 hidden md:table-cell">Limite</th>
                <th className="text-left p-3">Margem</th>
                <th className="text-left p-3 hidden lg:table-cell">Motivo</th>
                <th className="text-left p-3 hidden lg:table-cell">Por</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((h: any) => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-xs">{new Date(h.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="p-3">
                    <Link
                      href={`/empresa/funcionarios/${h.socio.id}`}
                      className="text-violet-700 dark:text-violet-300 hover:underline"
                    >
                      {h.socio.nome}
                    </Link>
                  </td>
                  <td className="p-3 text-xs hidden md:table-cell">
                    {formatCurrency(h.limiteAnterior || 0)} → {formatCurrency(h.limiteNovo || 0)}
                  </td>
                  <td className="p-3 text-xs">
                    <span className="text-muted-foreground">{formatCurrency(h.margemAnterior || 0)}</span>
                    {" → "}
                    <span className="font-medium">{formatCurrency(h.margemNova || 0)}</span>
                  </td>
                  <td className="p-3 hidden lg:table-cell">{h.motivo || "—"}</td>
                  <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {h.usuario || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Empty text="Nenhuma alteração no período." />
      )}
    </>
  )
}

// ─── BLOQUEADOS ────────────────────────────────────────────

function BloqueadosTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["rel-bloqueados"],
    queryFn: async () => {
      const r = await fetch("/api/empresa/relatorios/socios-bloqueados")
      if (!r.ok) throw new Error("erro")
      return r.json()
    },
  })

  if (isLoading) return <Loading />
  if (!data || data.total === 0) return <Empty text="Nenhum funcionário bloqueado." />

  return (
    <>
      <SummaryCard title="Funcionários Bloqueados" value={String(data.total)} icon={Lock} />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3 hidden md:table-cell">Matrícula</th>
              <th className="text-left p-3 hidden lg:table-cell">Função</th>
              <th className="text-left p-3">Motivo</th>
              <th className="text-left p-3 hidden md:table-cell">Bloqueado em</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((s: any) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <Link
                    href={`/empresa/funcionarios/${s.id}`}
                    className="text-violet-700 dark:text-violet-300 hover:underline font-medium"
                  >
                    {s.nome}
                  </Link>
                </td>
                <td className="p-3 hidden md:table-cell">{s.matricula || "—"}</td>
                <td className="p-3 hidden lg:table-cell">{s.funcao || "—"}</td>
                <td className="p-3 text-muted-foreground">{s.motivoBloqueio || "—"}</td>
                <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                  {new Date(s.updatedAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

// ─── Helpers ───────────────────────────────────────────────

function Loading() {
  return (
    <Card className="p-12 text-center">
      <Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-500" />
    </Card>
  )
}

function Empty({ text = "Nenhum dado encontrado." }: { text?: string }) {
  return (
    <Card className="p-12 text-center text-muted-foreground">
      <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
      {text}
    </Card>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  highlight,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
}) {
  return (
    <Card className={"p-4 " + (highlight ? "border-violet-200 dark:border-violet-900/40" : "")}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase">{title}</div>
          <div className={"text-xl font-bold mt-1 " + (highlight ? "text-violet-700 dark:text-violet-300" : "")}>
            {value}
          </div>
        </div>
        <div className="p-2 rounded-md bg-violet-500/10">
          <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
      </div>
    </Card>
  )
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

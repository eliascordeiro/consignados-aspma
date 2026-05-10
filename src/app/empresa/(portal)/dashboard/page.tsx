"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users,
  UserCheck,
  UserX,
  Wallet,
  TrendingUp,
  Calendar,
  Clock,
  AlertCircle,
  PiggyBank,
  ShoppingBag,
  XCircle,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface DashboardData {
  socios: {
    total: number
    ativos: number
    bloqueados: number
    inativos: number
  }
  margem: {
    totalDisponivel: number
    limiteTotal: number
  }
  vendas: {
    ativas: number
    mesAtual: number
    valorMesAtual: number
    canceladasMes: number
  }
  parcelas: {
    mesAtual: {
      quantidade: number
      valor: number
      pagas: number
      pendentes: number
    }
    futuras: { quantidade: number; valor: number }
    atrasadas: { quantidade: number; valor: number }
  }
  empresa: { id: number; nome: string; diaCorte: number }
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export default function EmpresaDashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["empresa-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/empresa/dashboard")
      if (!res.ok) throw new Error("Erro ao carregar dados do dashboard")
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Erro ao carregar o dashboard.
      </div>
    )
  }

  const now = new Date()
  const mesAtual = MESES[now.getMonth()]
  const ano = now.getFullYear()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Visão geral da consignatária <strong>{data.empresa.nome}</strong> •{" "}
            {mesAtual} de {ano}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full self-start sm:self-auto">
          <Calendar className="h-3.5 w-3.5" />
          Dia de corte: <strong>{data.empresa.diaCorte}</strong>
        </div>
      </div>

      {/* Funcionários */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Funcionários
        </h3>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total"
            value={data.socios.total}
            icon={Users}
            iconColor="text-violet-600 dark:text-violet-400"
            iconBg="bg-violet-500/10"
            href="/empresa/funcionarios"
          />
          <StatCard
            title="Ativos"
            value={data.socios.ativos}
            icon={UserCheck}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-500/10"
            href="/empresa/funcionarios?status=ativos"
          />
          <StatCard
            title="Bloqueados"
            value={data.socios.bloqueados}
            icon={UserX}
            iconColor="text-amber-600 dark:text-amber-400"
            iconBg="bg-amber-500/10"
            href="/empresa/funcionarios?status=bloqueados"
          />
          <StatCard
            title="Inativos"
            value={data.socios.inativos}
            icon={XCircle}
            iconColor="text-rose-600 dark:text-rose-400"
            iconBg="bg-rose-500/10"
            href="/empresa/funcionarios?status=inativos"
          />
        </div>
      </section>

      {/* Margem */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Margem & Limite (sócios ativos)
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <Card className="border-violet-200 dark:border-violet-900/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Margem Disponível</CardTitle>
              <div className="p-2 rounded-md bg-violet-500/10">
                <Wallet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.margem.totalDisponivel)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Soma da margem consignável de todos os funcionários ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Limite Total</CardTitle>
              <div className="p-2 rounded-md bg-indigo-500/10">
                <PiggyBank className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.margem.limiteTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Soma dos limites cadastrados dos funcionários ativos
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Vendas */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Vendas
        </h3>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Em andamento"
            value={data.vendas.ativas}
            icon={ShoppingBag}
            iconColor="text-blue-600 dark:text-blue-400"
            iconBg="bg-blue-500/10"
          />
          <StatCard
            title={`Vendas em ${mesAtual}`}
            value={data.vendas.mesAtual}
            icon={TrendingUp}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-500/10"
          />
          <StatCard
            title={`Valor em ${mesAtual}`}
            value={formatCurrency(data.vendas.valorMesAtual)}
            icon={Wallet}
            iconColor="text-violet-600 dark:text-violet-400"
            iconBg="bg-violet-500/10"
            isCurrency
          />
          <StatCard
            title="Canceladas no mês"
            value={data.vendas.canceladasMes}
            icon={XCircle}
            iconColor="text-rose-600 dark:text-rose-400"
            iconBg="bg-rose-500/10"
          />
        </div>
      </section>

      {/* Parcelas */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Parcelas
        </h3>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <Card className="border-blue-200 dark:border-blue-900/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Mês Atual ({mesAtual})</CardTitle>
              <div className="p-2 rounded-md bg-blue-500/10">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.parcelas.mesAtual.valor)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.parcelas.mesAtual.quantidade} parcela{data.parcelas.mesAtual.quantidade !== 1 ? 's' : ''}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {data.parcelas.mesAtual.pagas} pagas
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  {data.parcelas.mesAtual.pendentes} pendentes
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">A Receber (futuras)</CardTitle>
              <div className="p-2 rounded-md bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.parcelas.futuras.valor)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.parcelas.futuras.quantidade} parcela{data.parcelas.futuras.quantidade !== 1 ? 's' : ''} em meses futuros
              </p>
            </CardContent>
          </Card>

          <Card className={data.parcelas.atrasadas.quantidade > 0 ? "border-rose-300 dark:border-rose-900/60" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
              <div className="p-2 rounded-md bg-rose-500/10">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={"text-2xl font-bold " + (data.parcelas.atrasadas.quantidade > 0 ? "text-rose-600 dark:text-rose-400" : "")}>
                {formatCurrency(data.parcelas.atrasadas.valor)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.parcelas.atrasadas.quantidade} parcela{data.parcelas.atrasadas.quantidade !== 1 ? 's' : ''} vencidas e não pagas
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Atalhos rápidos */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Atalhos
        </h3>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            href="/empresa/funcionarios"
            icon={Users}
            title="Gerenciar Funcionários"
            description="Listar, bloquear, ajustar margem"
          />
          <ActionCard
            href="/empresa/funcionarios/novo"
            icon={UserCheck}
            title="Cadastrar Funcionário"
            description="Adicionar novo sócio"
          />
          <ActionCard
            href="/empresa/relatorios"
            icon={TrendingUp}
            title="Relatórios"
            description="Vendas, margem, parcelas"
          />
          <ActionCard
            href="/empresa/alterar-senha"
            icon={Wallet}
            title="Alterar Senha"
            description="Renovar acesso ao portal"
          />
        </div>
      </section>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  href?: string
  isCurrency?: boolean
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  href,
  isCurrency,
}: StatCardProps) {
  const content = (
    <Card className={href ? "transition-all hover:shadow-md hover:border-violet-300 dark:hover:border-violet-800/60 cursor-pointer" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={"p-2 rounded-md " + iconBg}>
          <Icon className={"h-4 w-4 " + iconColor} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={"font-bold " + (isCurrency ? "text-xl" : "text-2xl")}>
          {value}
        </div>
      </CardContent>
    </Card>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-lg border border-border bg-card hover:shadow-md hover:border-violet-300 dark:hover:border-violet-800/60 transition-all"
    >
      <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400 mb-2" />
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </Link>
  )
}

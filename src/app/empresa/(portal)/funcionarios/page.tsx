"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Users,
  Search,
  UserPlus,
  Lock,
  CheckCircle2,
  XCircle,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

interface SocioListItem {
  id: string
  nome: string
  cpf: string | null
  matricula: string | null
  funcao: string | null
  lotacao: string | null
  celular: string | null
  email: string | null
  limite: number | null
  margemConsig: number | null
  bloqueio: string | null
  motivoBloqueio: string | null
  ativo: boolean
}

interface ListResponse {
  items: SocioListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "ativos", label: "Ativos" },
  { value: "bloqueados", label: "Bloqueados" },
  { value: "inativos", label: "Inativos" },
]

export default function FuncionariosListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get("q") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "todos")
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"))
  const pageSize = 50

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["empresa-socios", q, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        q,
        status,
        page: String(page),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/empresa/socios?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar funcionários")
      return res.json()
    },
    placeholderData: (prev) => prev,
  })

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault()
    setPage(1)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status !== "todos") params.set("status", status)
    router.replace(`/empresa/funcionarios?${params}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            Funcionários
          </h2>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} funcionário${data.total !== 1 ? "s" : ""}` : "Carregando..."}
          </p>
        </div>
        <Link href="/empresa/funcionarios/novo">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar Novo
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <form onSubmit={applyFilters} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou matrícula..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  setStatus(opt.value)
                  setPage(1)
                }}
                className={
                  "px-3 py-1.5 text-sm rounded-md border transition-colors " +
                  (status === opt.value
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-background border-border hover:bg-muted")
                }
              >
                {opt.label}
              </button>
            ))}
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      {/* Lista */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum funcionário encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Matrícula</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Função</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">Margem</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Link
                        href={`/empresa/funcionarios/${s.id}`}
                        className="font-medium text-violet-700 dark:text-violet-300 hover:underline"
                      >
                        {s.nome}
                      </Link>
                      {s.cpf && (
                        <div className="text-xs text-muted-foreground">CPF: {formatCpf(s.cpf)}</div>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell">{s.matricula || "—"}</td>
                    <td className="p-3 hidden lg:table-cell">
                      <div>{s.funcao || "—"}</div>
                      {s.lotacao && <div className="text-xs text-muted-foreground">{s.lotacao}</div>}
                    </td>
                    <td className="p-3 text-right hidden md:table-cell">
                      <div className="flex items-center justify-end gap-1 font-medium">
                        <Wallet className="h-3.5 w-3.5 text-violet-500" />
                        {formatCurrency(s.margemConsig || 0)}
                      </div>
                    </td>
                    <td className="p-3 text-center">{renderStatus(s)}</td>
                    <td className="p-3 text-right">
                      <Link href={`/empresa/funcionarios/${s.id}`}>
                        <Button variant="ghost" size="sm">
                          Detalhes
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Paginação */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {data.page} de {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage(data.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage(data.page + 1)}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function renderStatus(s: SocioListItem) {
  if (!s.ativo) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400">
        <XCircle className="h-3 w-3" /> Inativo
      </span>
    )
  }
  if (s.bloqueio) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400"
        title={s.motivoBloqueio || ""}
      >
        <Lock className="h-3 w-3" /> Bloqueado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" /> Ativo
    </span>
  )
}

function formatCpf(cpf: string) {
  const c = cpf.replace(/\D/g, "")
  if (c.length !== 11) return cpf
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  FileText, 
  Download,
  Filter,
  Calendar,
  User,
  Activity
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { hasPermission } from "@/config/permissions"
import { useSession } from "next-auth/react"

interface AuditLog {
  id: string
  userId: string
  userName: string
  userRole: string
  action: string
  module: string
  entityId?: string
  entityName?: string
  description: string
  metadata?: any
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-purple-100 text-purple-800",
  LOGOUT: "bg-gray-100 text-gray-800",
  PASSWORD_RESET: "bg-yellow-100 text-yellow-800",
  EXPORT: "bg-orange-100 text-orange-800",
  IMPORT: "bg-cyan-100 text-cyan-800",
  VIEW: "bg-slate-100 text-slate-800",
}

const actionLabels: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Atualização",
  DELETE: "Exclusão",
  LOGIN: "Login",
  LOGOUT: "Logout",
  PASSWORD_RESET: "Reset de Senha",
  EXPORT: "Exportação",
  IMPORT: "Importação",
  VIEW: "Visualização",
}

const moduleLabels: Record<string, string> = {
  funcionarios: "Sócios",
  consignatarias: "Consignatárias",
  usuarios: "Usuários e Permissões",
  convenios: "Conveniados",
  consignados: "Consignados",
  auth: "Autenticação",
  sistema: "Sistema",
}

export default function LogsPage() {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [moduleFilter, setModuleFilter] = useState<string>("all")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const userPermissions = (session?.user as any)?.permissions || []

  useEffect(() => {
    fetchLogs()
  }, [page, moduleFilter, actionFilter])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      })

      if (search) params.append("search", search)
      if (moduleFilter !== "all") params.append("module", moduleFilter)
      if (actionFilter !== "all") params.append("action", actionFilter)

      const response = await fetch(`/api/cliente/logs?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setLogs(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("Erro ao buscar logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({
        limit: "10000", // Exportar muitos registros
      })

      if (search) params.append("search", search)
      if (moduleFilter !== "all") params.append("module", moduleFilter)
      if (actionFilter !== "all") params.append("action", actionFilter)

      const response = await fetch(`/api/cliente/logs?${params}`)
      const data = await response.json()

      // Converter para CSV
      const headers = ["Data/Hora", "Usuário", "Ação", "Módulo", "Descrição", "IP"]
      const rows = data.data.map((log: AuditLog) => [
        format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
        log.userName,
        actionLabels[log.action] || log.action,
        moduleLabels[log.module] || log.module,
        log.description,
        log.ipAddress || "-"
      ])

      const csv = [
        headers.join(";"),
        ...rows.map((row: string[]) => row.join(";"))
      ].join("\n")

      // Download
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `logs-auditoria-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Erro ao exportar logs:", error)
    }
  }

  if (!hasPermission(userPermissions, "logs.view")) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para visualizar logs de auditoria.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Logs de Auditoria</h1>
          <p className="text-gray-600 mt-1">Histórico de ações realizadas no sistema</p>
        </div>
        {hasPermission(userPermissions, "logs.export") && (
          <Button onClick={exportLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por usuário, descrição..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                <SelectItem value="funcionarios">Sócios</SelectItem>
                <SelectItem value="consignatarias">Consignatárias</SelectItem>
                <SelectItem value="usuarios">Usuários e Permissões</SelectItem>
                <SelectItem value="convenios">Conveniados</SelectItem>
                <SelectItem value="consignados">Consignados</SelectItem>
                <SelectItem value="auth">Autenticação</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="CREATE">Criação</SelectItem>
                <SelectItem value="UPDATE">Atualização</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
                <SelectItem value="PASSWORD_RESET">Reset de Senha</SelectItem>
                <SelectItem value="EXPORT">Exportação</SelectItem>
                <SelectItem value="IMPORT">Importação</SelectItem>
              </SelectContent>
            </Select>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico ({total} registros)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              Nenhum log encontrado
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{log.userName}</div>
                              <div className="text-xs text-gray-500">{log.userRole}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={actionColors[log.action] || "bg-gray-100 text-gray-800"}>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {moduleLabels[log.module] || log.module}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={log.description}>
                            {log.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {log.ipAddress || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Página {page} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Anterior
                  </Button>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

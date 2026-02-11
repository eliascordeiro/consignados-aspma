"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Wallet,
  History,
  Edit,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react"
import { hasPermission } from "@/config/permissions"
import { toast } from "sonner"

interface Empresa {
  id: number
  nome: string
}

interface MargemHistorico {
  id: string
  limiteAnterior: number | null
  limiteNovo: number | null
  margemAnterior: number | null
  margemNova: number | null
  motivo: string | null
  observacao: string | null
  createdAt: string
  usuario: { id: string; name: string }
}

interface Socio {
  id: string
  nome: string
  cpf: string | null
  matricula: string | null
  tipo: string | null
  limite: number | null
  limiteCalculado?: number
  fonteLimite?: string
  empresa: Empresa | null
  _count?: { margemHistoricos: number }
  margemHistoricos?: MargemHistorico[]
}

export default function MargemConsignadaPage() {
  const { data: session } = useSession()
  const userPermissions = (session?.user as any)?.permissions || []
  const canView = hasPermission(userPermissions, "margem.view")
  const canEdit = hasPermission(userPermissions, "margem.edit")

  const [socios, setSocios] = useState<Socio[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Dialog de edição
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null)
  const [formData, setFormData] = useState({
    limite: "",
    motivo: "",
    observacao: "",
  })
  const [saving, setSaving] = useState(false)
  const [limiteReadonly, setLimiteReadonly] = useState(false)
  const [fonteLimite, setFonteLimite] = useState<string>("")

  // Dialog de histórico
  const [histDialogOpen, setHistDialogOpen] = useState(false)
  const [histSocio, setHistSocio] = useState<Socio | null>(null)
  const [histLoading, setHistLoading] = useState(false)

  const loadSocios = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ search, page: String(page), limit: "50" })
      const res = await fetch(`/api/margem-consignada?${params}`)
      if (!res.ok) throw new Error("Erro ao carregar")
      const data = await res.json()
      setSocios(data.socios)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      toast.error("Erro ao carregar sócios")
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      loadSocios()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    loadSocios()
  }, [page])

  // Abrir edição
  const handleEdit = async (socio: Socio) => {
    setSelectedSocio(socio)
    
    // Buscar margem via API para determinar fonte (ZETRA ou local)
    let limiteCalculado = socio.limite?.toString() || "0"
    let isReadonly = false
    let fonte = "local"
    
    try {
      const margemResponse = await fetch(`/api/socios/${socio.id}/margem`)
      if (margemResponse.ok) {
        const margemData = await margemResponse.json()
        console.log('📊 Dados da margem:', margemData)
        
        // Se vier de ZETRA (tipos != 3,4), é somente leitura
        if (margemData.fonte === 'zetra') {
          isReadonly = true
          fonte = 'ZETRA'
        } else if (margemData.tipo === 'calculo_local') {
          fonte = 'Cálculo Local'
        } else {
          fonte = 'Banco de Dados'
        }
        
        limiteCalculado = (margemData.margem || margemData.limite || 0).toString()
      }
    } catch (error) {
      console.error("Erro ao buscar margem:", error)
    }
    
    setFormData({
      limite: limiteCalculado,
      motivo: "",
      observacao: "",
    })
    setLimiteReadonly(isReadonly)
    setFonteLimite(fonte)
    setEditDialogOpen(true)
  }

  // Salvar margem
  const handleSave = async () => {
    if (!selectedSocio) return
    
    // Se for ZETRA (readonly), não pode salvar
    if (limiteReadonly) {
      toast.error("Valores de ZETRA não podem ser alterados manualmente")
      return
    }
    
    if (!formData.motivo.trim()) {
      toast.error("Motivo é obrigatório")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/margem-consignada", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socioId: selectedSocio.id,
          limite: formData.limite,
          motivo: formData.motivo,
          observacao: formData.observacao,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Erro ao salvar")
        return
      }

      toast.success("Limite atualizado com sucesso!")
      setEditDialogOpen(false)
      loadSocios()
    } catch (error) {
      toast.error("Erro ao salvar limite")
    } finally {
      setSaving(false)
    }
  }

  // Abrir histórico
  const handleHistorico = async (socio: Socio) => {
    try {
      setHistLoading(true)
      setHistDialogOpen(true)
      const res = await fetch(`/api/margem-consignada?socioId=${socio.id}`)
      if (!res.ok) throw new Error("Erro ao carregar histórico")
      const data = await res.json()
      setHistSocio(data)
    } catch (error) {
      toast.error("Erro ao carregar histórico")
    } finally {
      setHistLoading(false)
    }
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "R$ 0,00"
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value))
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getDiffIcon = (anterior: number | null, novo: number | null) => {
    const a = Number(anterior || 0)
    const n = Number(novo || 0)
    if (n > a) return <ArrowUp className="h-3 w-3 text-green-600 inline" />
    if (n < a) return <ArrowDown className="h-3 w-3 text-red-600 inline" />
    return <ArrowUpDown className="h-3 w-3 text-gray-400 inline" />
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate flex items-center gap-2">
            <Wallet className="h-6 w-6 md:h-8 md:w-8 text-amber-600" />
            Margem Consignada
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie limites de crédito e margens consignáveis dos sócios
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="outline" className="h-10 px-4 flex items-center">
          {total} sócio{total !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Table */}
      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800 py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Margens dos Sócios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : socios.length === 0 ? (
            <div className="text-center py-16">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum sócio encontrado</h3>
              <p className="text-muted-foreground">Ajuste a busca para encontrar sócios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Matrícula</TableHead>
                    <TableHead className="font-semibold">CPF</TableHead>
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold text-right">Limite de Crédito</TableHead>
                    <TableHead className="font-semibold text-center">Alterações</TableHead>
                    <TableHead className="font-semibold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {socios.map((socio) => (
                    <TableRow key={socio.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <TableCell className="font-medium max-w-[200px] truncate">{socio.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{socio.matricula || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{socio.cpf || "-"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {socio.empresa?.nome || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <div className="flex flex-col items-end gap-1">
                          <span className={Number(socio.limiteCalculado || socio.limite || 0) > 0 ? "text-green-600 dark:text-green-400 font-semibold" : "text-muted-foreground"}>
                            {formatCurrency(socio.limiteCalculado || socio.limite)}
                          </span>
                          {socio.fonteLimite && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {socio.fonteLimite === 'zetra' ? 'ZETRA' : socio.fonteLimite === 'local' ? 'Local' : 'BD'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {socio._count?.margemHistoricos || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-500 dark:hover:text-amber-400 dark:hover:bg-amber-900/20"
                              onClick={() => handleEdit(socio)}
                              title="Alterar margem"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/20"
                            onClick={() => handleHistorico(socio)}
                            title="Ver histórico"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * 50) + 1} a {Math.min(page * 50, total)} de {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center px-3 text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Editar Margem */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-amber-600" />
              {limiteReadonly ? "Consultar Limite (ZETRA)" : "Alterar Limite de Crédito"}
            </DialogTitle>
            <DialogDescription>
              {selectedSocio && (
                <span>
                  <strong>{selectedSocio.nome}</strong>
                  {selectedSocio.matricula && ` — Mat. ${selectedSocio.matricula}`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Fonte dos dados */}
            {fonteLimite && (
              <div className={`rounded-lg p-3 ${limiteReadonly ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted/50'}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase">Fonte dos Dados</p>
                <p className="text-sm font-medium mt-1">
                  {fonteLimite}
                  {limiteReadonly && <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">(Somente Consulta)</span>}
                </p>
              </div>
            )}

            {/* Valor atual */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Valor Atual</p>
              <div className="text-sm">
                Limite: <span className="font-mono font-semibold">{formatCurrency(selectedSocio?.limite)}</span>
              </div>
            </div>

            {/* Novo valor */}
            <div className="space-y-2">
              <Label htmlFor="edit-limite" className="flex items-center gap-2">
                {limiteReadonly ? "Limite de Crédito (ZETRA)" : "Novo Limite de Crédito"}
                {limiteReadonly && <Badge variant="outline" className="text-xs">Somente Leitura</Badge>}
              </Label>
              <Input
                id="edit-limite"
                type="number"
                step="0.01"
                value={formData.limite}
                onChange={(e) => setFormData({ ...formData, limite: e.target.value })}
                disabled={limiteReadonly}
                className={limiteReadonly ? "bg-muted/50 cursor-not-allowed" : ""}
              />
              {limiteReadonly && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Valores de ZETRA não podem ser alterados manualmente
                </p>
              )}
            </div>

            {/* Motivo (obrigatório) - apenas se não for readonly */}
            {!limiteReadonly && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-motivo">
                    Motivo da Alteração <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-motivo"
                    placeholder="Ex: Reajuste salarial, Correção de valor..."
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  />
                </div>

                {/* Observação */}
                <div className="space-y-2">
                  <Label htmlFor="edit-obs">Observação</Label>
                  <Textarea
                    id="edit-obs"
                    placeholder="Observação adicional (opcional)"
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {limiteReadonly ? "Fechar" : "Cancelar"}
            </Button>
            {!limiteReadonly && (
              <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                {saving ? "Salvando..." : "Salvar Alteração"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico */}
      <Dialog open={histDialogOpen} onOpenChange={setHistDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Histórico de Limite
            </DialogTitle>
            <DialogDescription>
              {histSocio && (
                <span>
                  <strong>{histSocio.nome}</strong>
                  {histSocio.matricula && ` — Mat. ${histSocio.matricula}`}
                  {" | "}
                  Limite atual: <span className="font-mono font-semibold">{formatCurrency(histSocio.limite)}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {histLoading ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground">Carregando histórico...</p>
              </div>
            ) : !histSocio?.margemHistoricos?.length ? (
              <div className="text-center py-10">
                <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma alteração registrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold">Usuário</TableHead>
                    <TableHead className="font-semibold text-right">Limite</TableHead>
                    <TableHead className="font-semibold text-right">Margem</TableHead>
                    <TableHead className="font-semibold">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {histSocio.margemHistoricos.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(h.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">{h.usuario.name}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground">{formatCurrency(h.limiteAnterior)}</span>
                          {getDiffIcon(h.limiteAnterior, h.limiteNovo)}
                          <span className="font-semibold">{formatCurrency(h.limiteNovo)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground">{formatCurrency(h.margemAnterior)}</span>
                          {getDiffIcon(h.margemAnterior, h.margemNova)}
                          <span className="font-semibold">{formatCurrency(h.margemNova)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        <p className="truncate" title={h.motivo || ""}>{h.motivo || "-"}</p>
                        {h.observacao && (
                          <p className="text-xs text-muted-foreground truncate" title={h.observacao}>
                            {h.observacao}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

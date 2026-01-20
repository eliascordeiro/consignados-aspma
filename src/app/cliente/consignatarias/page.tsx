"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { hasPermission } from "@/config/permissions"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Trash2, Search, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Empresa {
  id: number
  nome: string
  cnpj?: string
  tipo: string
  telefone?: string
  email?: string
  contato?: string
  cep?: string
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  ativo: boolean
}

export default function ConsignatariasPage() {
  const { data: session } = useSession()
  const userPermissions = (session?.user as any)?.permissions || []
  
  // Verificar permissões
  const canView = hasPermission(userPermissions, "consignatarias.view")
  const canCreate = hasPermission(userPermissions, "consignatarias.create")
  const canEdit = hasPermission(userPermissions, "consignatarias.edit")
  const canDelete = hasPermission(userPermissions, "consignatarias.delete")
  
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null)
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    tipo: "PUBLICO",
    telefone: "",
    email: "",
    contato: "",
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    ativo: true,
  })

  const loadEmpresas = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/consignatarias?search=${searchTerm}`)
      if (response.ok) {
        const data = await response.json()
        setEmpresas(data)
      }
    } catch (error) {
      console.error("Erro ao carregar consignatárias:", error)
    } finally {
      setLoading(false)
    }
  }

  // Carregar empresas apenas uma vez ao montar
  useEffect(() => {
    loadEmpresas()
  }, [])

  // Aplicar debounce apenas quando search mudar
  useEffect(() => {
    const debounce = setTimeout(() => {
      loadEmpresas()
    }, searchTerm === "" ? 0 : 500)
    return () => clearTimeout(debounce)
  }, [searchTerm])

  const handleEdit = (empresa: Empresa) => {
    setSelectedEmpresa(empresa)
    setFormData({
      nome: empresa.nome,
      cnpj: empresa.cnpj || "",
      tipo: empresa.tipo,
      telefone: empresa.telefone || "",
      email: empresa.email || "",
      contato: empresa.contato || "",
      cep: empresa.cep || "",
      rua: empresa.rua || "",
      numero: empresa.numero || "",
      bairro: empresa.bairro || "",
      cidade: empresa.cidade || "",
      uf: empresa.uf || "",
      ativo: empresa.ativo,
    })
    setDialogOpen(true)
  }

  const handleNew = () => {
    setSelectedEmpresa(null)
    setFormData({
      nome: "",
      cnpj: "",
      tipo: "PUBLICO",
      telefone: "",
      email: "",
      contato: "",
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      ativo: true,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = selectedEmpresa
        ? `/api/consignatarias/${selectedEmpresa.id}`
        : "/api/consignatarias"
      
      const method = selectedEmpresa ? "PUT" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Erro ao salvar consignatária")
        return
      }

      loadEmpresas()
      setDialogOpen(false)
    } catch (error) {
      alert("Erro ao salvar consignatária")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (empresa: Empresa) => {
    if (!confirm(`Tem certeza que deseja excluir ${empresa.nome}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/consignatarias/${empresa.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        loadEmpresas()
      } else {
        const error = await response.json()
        alert(error.error || "Erro ao excluir consignatária")
      }
    } catch (error) {
      alert("Erro ao excluir consignatária")
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">Consignatárias</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
            Gerencie as empresas consignatárias
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleNew} size="sm" className="flex-shrink-0">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Nova Consignatária</span>
            <span className="md:hidden">Nova</span>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consignatárias Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou status (ativo/inativo)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : empresas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma consignatária encontrada
            </div>
          ) : (
            <VirtualizedEmpresasTable 
              empresas={empresas}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canView={canView}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl h-auto md:h-[85vh] max-h-[90vh] overflow-hidden bg-slate-50 dark:bg-slate-900 consignado:bg-blue-50 consignado:dark:bg-slate-900 flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {selectedEmpresa ? "Editar Consignatária" : "Nova Consignatária"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da consignatária
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="grid gap-4 py-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLICO">Público</SelectItem>
                      <SelectItem value="PRIVADO">Privado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contato">Pessoa de Contato</Label>
                  <Input
                    id="contato"
                    value={formData.contato}
                    onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="rua">Rua</Label>
                  <Input
                    id="rua"
                    value={formData.rua}
                    onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf">UF</Label>
                  <Input
                    id="uf"
                    value={formData.uf}
                    maxLength={2}
                    onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="ativo" className="cursor-pointer">Ativo</Label>
              </div>
            </div>
            <DialogFooter className="shrink-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              {canEdit && (
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Componente de tabela virtualizada para empresas
function VirtualizedEmpresasTable({ 
  empresas, 
  onEdit, 
  onDelete,
  canView,
  canEdit,
  canDelete
}: { 
  empresas: Empresa[]
  onEdit: (empresa: Empresa) => void
  onDelete: (empresa: Empresa) => void
  canView: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  const rowVirtualizer = useVirtualizer({
    count: empresas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => isMobile ? 180 : 72,
    overscan: 5,
  })

  return (
    <div className="border rounded-md">
      <div 
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px' }}
      >
        <div className="w-full">
          {/* Header fixo - apenas desktop */}
          {!isMobile && (
            <div className="sticky top-0 bg-background z-10 border-b">
              <div className="hidden md:grid md:grid-cols-[2.5fr_180px_120px_90px_100px] lg:grid-cols-[3fr_220px_130px_100px_120px] gap-3 lg:gap-4 p-3 font-medium text-sm">
                <div>Nome da Empresa</div>
                <div>Contato</div>
                <div>Tipo</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>
            </div>
          )}
          
          {/* Virtual scrolling container */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const empresa = empresas[virtualRow.index]
              
              return (
                <div
                  key={empresa.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b hover:bg-muted/50"
                >
                  {/* Layout Mobile - Cards */}
                  <div className="md:hidden p-3 space-y-2.5 bg-white dark:bg-gray-950">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-snug break-words">
                          {empresa.nome}
                        </div>
                      </div>
                      {((canView || canEdit) || canDelete) && (
                        <div className="flex gap-1 flex-shrink-0">
                          {(canView || canEdit) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onEdit(empresa)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onDelete(empresa)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 text-xs">
                      {(empresa.contato || empresa.telefone) && (
                        <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-md">
                          <div className="text-muted-foreground mb-0.5">Contato:</div>
                          {empresa.contato && (
                            <div className="font-medium text-gray-900 dark:text-gray-100 break-words">
                              {empresa.contato}
                            </div>
                          )}
                          {empresa.telefone && (
                            <div className="text-gray-600 dark:text-gray-400">
                              {empresa.telefone}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Tipo:</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            empresa.tipo === "PUBLICO" 
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" 
                              : "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                          }`}>
                            {empresa.tipo === "PUBLICO" ? "Público" : "Privado"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Status:</span>
                          {empresa.ativo ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                              ✓ Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              Inativo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Layout Desktop/Tablet - Grid */}
                  <div className="hidden md:grid md:grid-cols-[2.5fr_180px_120px_90px_100px] lg:grid-cols-[3fr_220px_130px_100px_120px] gap-3 lg:gap-4 p-3 items-center text-sm">
                    <div className="min-w-0 font-medium">
                      <div className="truncate">{empresa.nome}</div>
                    </div>
                    
                    <div className="text-xs min-w-0">
                      {empresa.contato || empresa.telefone ? (
                        <div className="flex flex-col gap-0.5">
                          {empresa.contato && (
                            <span className="font-medium truncate">{empresa.contato}</span>
                          )}
                          {empresa.telefone && (
                            <span className="text-muted-foreground">{empresa.telefone}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Não informado</span>
                      )}
                    </div>
                    
                    <div>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        empresa.tipo === "PUBLICO" 
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" 
                          : "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      }`}>
                        {empresa.tipo === "PUBLICO" ? "Público" : "Privado"}
                      </span>
                    </div>
                    
                    <div>
                      {empresa.ativo ? (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700">
                          Inativo
                        </span>
                      )}
                    </div>
                    
                    {((canView || canEdit) || canDelete) && (
                      <div className="flex justify-end gap-2">
                        {(canView || canEdit) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(empresa)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(empresa)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

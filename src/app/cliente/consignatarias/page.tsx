"use client"

import { useState, useEffect, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Search, Building2, Plus } from "lucide-react"
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

  useEffect(() => {
    loadEmpresas()
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadEmpresas()
    }, 500)
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Consignatárias</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gerencie as empresas consignatárias
          </p>
        </div>
        <Button onClick={handleNew} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nova Consignatária
        </Button>
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar consignatárias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Lista de Consignatárias
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 px-4">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : empresas.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6">
                  <Building2 className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma consignatária cadastrada</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Comece adicionando a primeira consignatária
              </p>
            </div>
          ) : (
            <VirtualizedEmpresasTable 
              empresas={empresas}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEmpresa ? "Editar Consignatária" : "Nova Consignatária"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da consignatária
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="rua">Rua</Label>
                  <Input
                    id="rua"
                    value={formData.rua}
                    onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
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
  onDelete 
}: { 
  empresas: Empresa[]
  onEdit: (empresa: Empresa) => void
  onDelete: (empresa: Empresa) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const rowVirtualizer = useVirtualizer({
    count: empresas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  // Formata CNPJ: 00.000.000/0000-00
  const formatCNPJ = (cnpj: string | undefined) => {
    if (!cnpj) return null
    const cleaned = cnpj.replace(/\D/g, '')
    if (cleaned.length !== 14) return cnpj
    return `${cleaned.slice(0,2)}.${cleaned.slice(2,5)}.${cleaned.slice(5,8)}/${cleaned.slice(8,12)}-${cleaned.slice(12,14)}`
  }

  return (
    <div className="border rounded-md bg-white dark:bg-gray-950">
      <div 
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px' }}
      >
        <div className="w-full">
          {/* Header fixo */}
          <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 border-b">
            <div className="grid grid-cols-[2.5fr_180px_160px_180px_110px_90px_110px] gap-4 px-4 py-3.5 font-semibold text-sm text-gray-700 dark:text-gray-300">
              <div>Nome da Empresa</div>
              <div>CNPJ</div>
              <div>Localização</div>
              <div>Contato</div>
              <div>Tipo</div>
              <div>Status</div>
              <div className="text-right">Ações</div>
            </div>
          </div>
          
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
              const formattedCNPJ = formatCNPJ(empresa.cnpj)
              
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
                  className="border-b hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors"
                >
                  <div className="grid grid-cols-[2.5fr_180px_160px_180px_110px_90px_110px] gap-4 px-4 py-4 items-center">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {empresa.nome}
                      </div>
                    </div>
                    
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {formattedCNPJ || (
                        <span className="text-gray-400 dark:text-gray-600 italic">Não informado</span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {empresa.cidade && empresa.uf ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{empresa.cidade}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-500">{empresa.uf}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 italic">Não informado</span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {empresa.contato || empresa.telefone ? (
                        <div className="flex flex-col gap-0.5">
                          {empresa.contato && (
                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{empresa.contato}</span>
                          )}
                          {empresa.telefone && (
                            <span className="text-xs text-gray-500 dark:text-gray-500">{empresa.telefone}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 italic">Não informado</span>
                      )}
                    </div>
                    
                    <div>
                      <Badge 
                        variant="outline"
                        className={empresa.tipo === "PUBLICO" 
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" 
                          : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
                        }
                      >
                        {empresa.tipo === "PUBLICO" ? "Público" : "Privado"}
                      </Badge>
                    </div>
                    
                    <div>
                      <Badge 
                        className={empresa.ativo 
                          ? "bg-green-500 hover:bg-green-600 text-white border-0" 
                          : "bg-gray-200 text-gray-700 border-0 dark:bg-gray-700 dark:text-gray-300"
                        }
                      >
                        {empresa.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
                        onClick={() => onEdit(empresa)}
                        title="Editar empresa"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                        onClick={() => onDelete(empresa)}
                        title="Excluir empresa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

"use client"

import { useState, useEffect } from "react"
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">CNPJ</TableHead>
                    <TableHead className="font-semibold">Cidade/UF</TableHead>
                    <TableHead className="font-semibold">Contato</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((empresa) => (
                    <TableRow key={empresa.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <TableCell className="font-medium">{empresa.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{empresa.cnpj || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {empresa.cidade && empresa.uf ? `${empresa.cidade}/${empresa.uf}` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{empresa.contato || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {empresa.tipo === "PUBLICO" ? "Público" : "Privado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={empresa.ativo ? "default" : "secondary"}
                          className={empresa.ativo ? "bg-green-500 hover:bg-green-600 text-white" : ""}
                        >
                          {empresa.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(empresa)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                            onClick={() => handleDelete(empresa)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

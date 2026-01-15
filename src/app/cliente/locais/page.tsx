"use client"

import { useEffect, useState, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Convenio {
  id: number
  codigo?: string | null
  razao_soc?: string | null
  fantasia?: string | null
  nome: string
  cnpj?: string | null
  cgc?: string | null
  tipo?: string | null
  desconto?: number | null
  parcelas?: number | null
  libera?: string | null
  endereco?: string | null
  bairro?: string | null
  cep?: string | null
  cidade?: string | null
  estado?: string | null
  uf?: string | null
  telefone?: string | null
  fone?: string | null
  fax?: string | null
  contato?: string | null
  email?: string | null
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  ativo: boolean
}

// Função helper para converter o campo libera em tipo
function getTipoFromLibera(libera: string | null | undefined): string {
  if (libera === 'X') return 'BANCO'
  if (libera === 'T') return 'TESTE'
  return 'COMERCIO' // 'C', em branco ou qualquer outro valor
}

// Função helper para converter tipo em libera
function getLiberaFromTipo(tipo: string): string {
  if (tipo === 'BANCO') return 'X'
  if (tipo === 'TESTE') return 'T'
  return 'C' // COMERCIO
}

export default function LocaisPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConvenio, setEditingConvenio] = useState<Convenio | null>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    codigo: "",
    razao_soc: "",
    fantasia: "",
    nome: "",
    cnpj: "",
    tipo: "COMERCIO",
    libera: "C",
    desconto: "",
    parcelas: "",
    endereco: "",
    bairro: "",
    cep: "",
    cidade: "",
    estado: "PR",
    telefone: "",
    fax: "",
    contato: "",
    email: "",
    banco: "",
    agencia: "",
    conta: "",
    ativo: true,
  })

  useEffect(() => {
    loadConvenios()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadConvenios()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadConvenios = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/convenios?search=${searchTerm}&limit=1000`)
      if (!response.ok) throw new Error("Erro ao carregar convênios")
      const result = await response.json()
      // API agora retorna { data, pagination }
      setConvenios(result.data || result)
    } catch (error) {
      toast.error("Erro ao carregar convênios")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingConvenio
        ? `/api/convenios/${editingConvenio.id}`
        : "/api/convenios"
      
      const method = editingConvenio ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao salvar convênio")
      }

      toast.success(
        editingConvenio
          ? "Convênio atualizado com sucesso!"
          : "Convênio cadastrado com sucesso!"
      )

      setIsDialogOpen(false)
      resetForm()
      loadConvenios()
    } catch (error: any) {
      toast.error(error.message)
      console.error(error)
    }
  }

  const handleEdit = (convenio: Convenio) => {
    setEditingConvenio(convenio)
    setFormData({
      codigo: convenio.codigo || "",
      razao_soc: convenio.razao_soc || "",
      fantasia: convenio.fantasia || "",
      nome: convenio.nome || "",
      cnpj: convenio.cnpj || convenio.cgc || "",
      tipo: getTipoFromLibera(convenio.libera),
      libera: convenio.libera || "C",
      desconto: convenio.desconto?.toString() || "",
      parcelas: convenio.parcelas?.toString() || "",
      endereco: convenio.endereco || "",
      bairro: convenio.bairro || "",
      cep: convenio.cep || "",
      cidade: convenio.cidade || "",
      estado: convenio.estado || convenio.uf || "PR",
      telefone: convenio.telefone || convenio.fone || "",
      fax: convenio.fax || "",
      contato: convenio.contato || "",
      email: convenio.email || "",
      banco: convenio.banco || "",
      agencia: convenio.agencia || "",
      conta: convenio.conta || "",
      ativo: convenio.ativo,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este convênio?")) return

    try {
      const response = await fetch(`/api/convenios/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao excluir convênio")
      }

      toast.success("Convênio excluído com sucesso!")
      loadConvenios()
    } catch (error: any) {
      toast.error(error.message)
      console.error(error)
    }
  }

  const resetForm = () => {
    setEditingConvenio(null)
    setFormData({
      codigo: "",
      razao_soc: "",
      fantasia: "",
      nome: "",
      cnpj: "",
      tipo: "COMERCIO",
      libera: "C",
      desconto: "",
      parcelas: "",
      endereco: "",
      bairro: "",
      cep: "",
      cidade: "",
      estado: "PR",
      telefone: "",
      fax: "",
      contato: "",
      email: "",
      banco: "",
      agencia: "",
      conta: "",
      ativo: true,
    })
  }

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Convênios</h1>
          <p className="text-muted-foreground">
            Gerencie os convênios autorizados (bancos, comércios, cooperativas, etc)
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Convênio
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl">
                {editingConvenio ? "Editar Convênio" : "Novo Convênio"}
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Preencha os dados do convênio (banco, comércio, cooperativa, etc)
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                  Dados Principais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) =>
                        setFormData({ ...formData, codigo: e.target.value })
                      }
                      placeholder="Ex: 001"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                    <Label htmlFor="razao_soc">Razão Social *</Label>
                    <Input
                      id="razao_soc"
                      value={formData.razao_soc}
                      onChange={(e) =>
                        setFormData({ ...formData, razao_soc: e.target.value })
                      }
                      placeholder="Ex: Banco do Brasil S.A."
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="libera">Categoria *</Label>
                    <Select
                      value={formData.libera}
                      onValueChange={(value) =>
                        setFormData({ 
                          ...formData, 
                          libera: value,
                          tipo: getTipoFromLibera(value)
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="X">Banco</SelectItem>
                        <SelectItem value="C">Comércio</SelectItem>
                        <SelectItem value="T">Teste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="tipo">Tipo (Calculado)</Label>
                    <Input
                      id="tipo"
                      value={formData.tipo}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                    <Label htmlFor="fantasia">Nome Fantasia</Label>
                    <Input
                      id="fantasia"
                      value={formData.fantasia}
                      onChange={(e) =>
                        setFormData({ ...formData, fantasia: e.target.value })
                      }
                      placeholder="Ex: Banco do Brasil"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ/CPF</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) =>
                        setFormData({ ...formData, cnpj: e.target.value })
                      }
                      placeholder="00.000.000/0001-00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="desconto">Desconto (%)</Label>
                    <Input
                      id="desconto"
                      type="number"
                      step="0.01"
                      value={formData.desconto}
                      onChange={(e) =>
                        setFormData({ ...formData, desconto: e.target.value })
                      }
                      placeholder="3.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="parcelas">Parcelas</Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="1"
                      value={formData.parcelas}
                      onChange={(e) =>
                        setFormData({ ...formData, parcelas: e.target.value })
                      }
                      placeholder="Ex: 12"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                  Endereço
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                    <Label htmlFor="endereco">Logradouro</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) =>
                        setFormData({ ...formData, endereco: e.target.value })
                      }
                      placeholder="Rua, avenida, número"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) =>
                        setFormData({ ...formData, bairro: e.target.value })
                      }
                      placeholder="Ex: Centro"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) =>
                        setFormData({ ...formData, cep: e.target.value })
                      }
                      placeholder="00000-000"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) =>
                        setFormData({ ...formData, cidade: e.target.value })
                      }
                      placeholder="Ex: Araucária"
                    />
                  </div>

                  <div>
                    <Label htmlFor="estado">UF</Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={(e) =>
                        setFormData({ ...formData, estado: e.target.value.toUpperCase() })
                      }
                      placeholder="PR"
                      maxLength={2}
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                  Dados Bancários (se aplicável)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="banco">Banco</Label>
                    <Input
                      id="banco"
                      value={formData.banco}
                      onChange={(e) =>
                        setFormData({ ...formData, banco: e.target.value })
                      }
                      placeholder="Ex: ITAU, BRASIL"
                    />
                  </div>

                  <div>
                    <Label htmlFor="agencia">Agência</Label>
                    <Input
                      id="agencia"
                      value={formData.agencia}
                      onChange={(e) =>
                        setFormData({ ...formData, agencia: e.target.value })
                      }
                      placeholder="Ex: 0001"
                    />
                  </div>

                  <div>
                    <Label htmlFor="conta">Conta</Label>
                    <Input
                      id="conta"
                      value={formData.conta}
                      onChange={(e) =>
                        setFormData({ ...formData, conta: e.target.value })
                      }
                      placeholder="Ex: 12345-6"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                  Informações de Contato
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) =>
                        setFormData({ ...formData, telefone: e.target.value })
                      }
                      placeholder="(41) 3901-2000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="fax">Fax</Label>
                    <Input
                      id="fax"
                      value={formData.fax}
                      onChange={(e) =>
                        setFormData({ ...formData, fax: e.target.value })
                      }
                      placeholder="(41) 3901-2001"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contato">Pessoa de Contato</Label>
                    <Input
                      id="contato"
                      value={formData.contato}
                      onChange={(e) =>
                        setFormData({ ...formData, contato: e.target.value })
                      }
                      placeholder="Nome do responsável"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="contato@convenio.com.br"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t gap-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, ativo: checked })
                    }
                  />
                  <Label htmlFor="ativo" className="cursor-pointer font-medium">
                    Convênio ativo
                  </Label>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="lg" className="w-full sm:w-auto">
                    {editingConvenio ? "Atualizar Convênio" : "Cadastrar Convênio"}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Convênios Cadastrados</CardTitle>
          <CardDescription>
            Lista de bancos, cooperativas e comércios autorizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ, tipo ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : convenios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum convênio encontrado
            </div>
          ) : (
            <VirtualizedTable 
              convenios={convenios}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de tabela virtualizada
function VirtualizedTable({ 
  convenios, 
  onEdit, 
  onDelete 
}: { 
  convenios: Convenio[]
  onEdit: (convenio: Convenio) => void
  onDelete: (id: number) => void
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
    count: convenios.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => isMobile ? 180 : 65,
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
              <div className="hidden md:grid md:grid-cols-[80px_2fr_140px_140px_90px_110px] lg:grid-cols-[100px_2fr_150px_150px_100px_120px] gap-3 lg:gap-4 p-3 font-medium text-sm">
                <div>Código</div>
                <div>Nome</div>
                <div>Tipo</div>
                <div>Banco</div>
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
              const convenio = convenios[virtualRow.index]
              return (
                <div
                  key={convenio.id}
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
                  <div className="md:hidden p-4 space-y-3 bg-white dark:bg-gray-950">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight">
                          {convenio.razao_soc || convenio.nome}
                        </div>
                        {convenio.fantasia && (
                          <div className="text-xs text-muted-foreground mt-1 leading-tight">{convenio.fantasia}</div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onEdit(convenio)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => onDelete(convenio.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Código:</span>{' '}
                          <span className="font-mono font-medium">{convenio.codigo || "-"}</span>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          convenio.tipo === 'BANCO' 
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' 
                            : convenio.tipo === 'COOPERATIVA'
                            ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        }`}>
                          {convenio.tipo}
                        </span>
                      </div>
                      
                      {convenio.banco && (
                        <div className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                          <span className="text-muted-foreground">Banco:</span>{' '}
                          <span className="font-medium text-gray-900 dark:text-gray-100">{convenio.banco}</span>
                          {convenio.agencia && (
                            <span className="text-muted-foreground ml-1">• Ag: {convenio.agencia}</span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground mr-2">Status:</span>
                        {convenio.ativo ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                            ✓ Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Layout Desktop/Tablet - Grid */}
                  <div className="hidden md:grid md:grid-cols-[80px_2fr_140px_140px_90px_110px] lg:grid-cols-[100px_2fr_150px_150px_100px_120px] gap-3 lg:gap-4 p-3 items-center text-sm">
                    <div className="font-mono text-xs">{convenio.codigo || "-"}</div>
                    <div className="font-medium min-w-0">
                      <div className="flex flex-col">
                        <span className="truncate">{convenio.razao_soc || convenio.nome}</span>
                        {convenio.fantasia && (
                          <span className="text-xs text-muted-foreground truncate">{convenio.fantasia}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        convenio.tipo === 'BANCO' 
                          ? 'bg-blue-50 text-blue-700' 
                          : convenio.tipo === 'COOPERATIVA'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {convenio.tipo}
                      </span>
                    </div>
                    <div className="min-w-0">
                      {convenio.banco ? (
                        <div className="flex flex-col text-xs">
                          <span className="font-medium truncate">{convenio.banco}</span>
                          {convenio.agencia && <span className="text-muted-foreground truncate">Ag: {convenio.agencia}</span>}
                        </div>
                      ) : "-"}
                    </div>
                    <div>
                      {convenio.ativo ? (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(convenio)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(convenio.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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

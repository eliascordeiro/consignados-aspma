"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface Empresa {
  id: number
  nome: string
}

interface Funcionario {
  id: string
  nome: string
  cpf?: string
  rg?: string
  matricula?: string
  empresaId?: number | null
  empresa?: Empresa | null
  funcao?: string
  lotacao?: string
  endereco?: string
  bairro?: string
  cep?: string
  cidade?: string
  telefone?: string
  celular?: string
  email?: string
  contato?: string
  dataCadastro?: string
  dataAdmissao?: string
  dataNascimento?: string
  limite?: number
  margemConsig?: number
  gratificacao?: number
  autorizado?: boolean
  sexo?: string
  estadoCivil?: string
  numCompras?: number
  tipo?: string
  agencia?: string
  conta?: string
  banco?: string
  devolucao?: boolean
  bloqueio?: boolean
  motivoBloqueio?: string
  codTipo?: string
  senha?: string
  dataExclusao?: string
  motivoExclusao?: string
  ativo: boolean
}

export default function FuncionariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const userPermissions = (session?.user as any)?.permissions || []
  
  // Verificar permissões
  const canView = hasPermission(userPermissions, "funcionarios.view")
  const canCreate = hasPermission(userPermissions, "funcionarios.create")
  const canEdit = hasPermission(userPermissions, "funcionarios.edit")
  const canDelete = hasPermission(userPermissions, "funcionarios.delete")
  
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFuncionario, setSelectedFuncionario] = useState<Funcionario | null>(null)
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    rg: "",
    matricula: "",
    empresaId: "",
    funcao: "",
    lotacao: "",
    endereco: "",
    bairro: "",
    cep: "",
    cidade: "",
    telefone: "",
    celular: "",
    email: "",
    contato: "",
    dataCadastro: "",
    dataAdmissao: "",
    dataNascimento: "",
    limite: "",
    margemConsig: "",
    gratificacao: "",
    autorizado: "",
    sexo: "",
    estadoCivil: "",
    numCompras: "",
    tipo: "",
    agencia: "",
    conta: "",
    banco: "",
    devolucao: "",
    bloqueio: "",
    motivoBloqueio: "",
    codTipo: "",
    senha: "",
    dataExclusao: "",
    motivoExclusao: "",
    ativo: true,
  })

  const loadFuncionarios = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/funcionarios?search=${searchTerm}&page=${page}&limit=50`)
      if (response.ok) {
        const result = await response.json()
        setFuncionarios(result.data || [])
        setTotalPages(result.pagination?.totalPages || 1)
        setTotal(result.pagination?.total || 0)
      }
    } catch (error) {
      console.error("Erro ao carregar funcionários:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadEmpresas = async () => {
    try {
      const response = await fetch("/api/consignatarias")
      if (response.ok) {
        const data = await response.json()
        setEmpresas(data)
      }
    } catch (error) {
      console.error("Erro ao carregar empresas:", error)
    }
  }

  // Verificar autenticação
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // Carregar empresas uma única vez
  useEffect(() => {
    if (status === "authenticated") {
      loadEmpresas()
    }
  }, [status])

  // Resetar página quando searchTerm mudar
  useEffect(() => {
    if (searchTerm !== "") {
      setPage(1)
    }
  }, [searchTerm])

  // Carregar funcionários quando page mudar
  useEffect(() => {
    if (status === "authenticated") {
      loadFuncionarios()
    }
  }, [status, page])

  // Aplicar debounce no search
  useEffect(() => {
    if (status === "authenticated" && searchTerm !== "") {
      const debounce = setTimeout(() => {
        loadFuncionarios()
      }, 500)
      return () => clearTimeout(debounce)
    }
  }, [searchTerm])

  const formatDate = (dateString?: string) => {
    if (!dateString) return ""
    return new Date(dateString).toISOString().split("T")[0]
  }

  const handleEdit = async (funcionario: Funcionario) => {
    try {
      setLoading(true)
      // Buscar dados completos do funcionário
      const response = await fetch(`/api/funcionarios/${funcionario.id}`)
      if (!response.ok) {
        throw new Error("Erro ao carregar dados do funcionário")
      }
      
      const funcionarioCompleto = await response.json()
      
      setSelectedFuncionario(funcionarioCompleto)
      setFormData({
        nome: funcionarioCompleto.nome,
        cpf: funcionarioCompleto.cpf || "",
        rg: funcionarioCompleto.rg || "",
        matricula: funcionarioCompleto.matricula || "",
        empresaId: funcionarioCompleto.empresaId?.toString() || "",
        funcao: funcionarioCompleto.funcao || "",
        lotacao: funcionarioCompleto.lotacao || "",
        endereco: funcionarioCompleto.endereco || "",
        bairro: funcionarioCompleto.bairro || "",
        cep: funcionarioCompleto.cep || "",
        cidade: funcionarioCompleto.cidade || "",
        telefone: funcionarioCompleto.telefone || "",
        celular: funcionarioCompleto.celular || "",
        email: funcionarioCompleto.email || "",
        contato: funcionarioCompleto.contato || "",
        dataCadastro: formatDate(funcionarioCompleto.dataCadastro),
        dataAdmissao: formatDate(funcionarioCompleto.dataAdmissao),
        dataNascimento: formatDate(funcionarioCompleto.dataNascimento),
        limite: funcionarioCompleto.limite?.toString() || "",
        margemConsig: funcionarioCompleto.margemConsig?.toString() || "",
        gratificacao: funcionarioCompleto.gratificacao?.toString() || "",
        autorizado: funcionarioCompleto.autorizado || "",
        sexo: funcionarioCompleto.sexo || "",
        estadoCivil: funcionarioCompleto.estadoCivil || "",
        numCompras: funcionarioCompleto.numCompras?.toString() || "",
        tipo: funcionarioCompleto.tipo || "",
        agencia: funcionarioCompleto.agencia || "",
        conta: funcionarioCompleto.conta || "",
        banco: funcionarioCompleto.banco || "",
        devolucao: funcionarioCompleto.devolucao?.toString() || "",
        bloqueio: funcionarioCompleto.bloqueio || "",
        motivoBloqueio: funcionarioCompleto.motivoBloqueio || "",
        codTipo: funcionarioCompleto.codTipo?.toString() || "",
        senha: funcionarioCompleto.senha || "",
        dataExclusao: formatDate(funcionarioCompleto.dataExclusao),
        motivoExclusao: funcionarioCompleto.motivoExclusao || "",
        ativo: funcionarioCompleto.ativo,
      })
      setDialogOpen(true)
    } catch (error) {
      console.error("Erro ao carregar funcionário:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleNew = () => {
    setSelectedFuncionario(null)
    setFormData({
      nome: "",
      cpf: "",
      rg: "",
      matricula: "",
      empresaId: "",
      funcao: "",
      lotacao: "",
      endereco: "",
      bairro: "",
      cep: "",
      cidade: "",
      telefone: "",
      celular: "",
      email: "",
      contato: "",
      dataCadastro: "",
      dataAdmissao: "",
      dataNascimento: "",
      limite: "",
      margemConsig: "",
      gratificacao: "",
      autorizado: "",
      sexo: "",
      estadoCivil: "",
      numCompras: "",
      tipo: "",
      agencia: "",
      conta: "",
      banco: "",
      devolucao: "",
      bloqueio: "N",
      motivoBloqueio: "",
      codTipo: "",
      senha: "",
      dataExclusao: "",
      motivoExclusao: "",
      ativo: true,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = selectedFuncionario
        ? `/api/funcionarios/${selectedFuncionario.id}`
        : "/api/funcionarios"
      
      const method = selectedFuncionario ? "PUT" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Erro ao salvar funcionário")
        return
      }

      loadFuncionarios()
      setDialogOpen(false)
    } catch (error) {
      alert("Erro ao salvar funcionário")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (funcionario: Funcionario) => {
    if (!confirm(`Tem certeza que deseja excluir ${funcionario.nome}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/funcionarios/${funcionario.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        loadFuncionarios()
      } else {
        const error = await response.json()
        alert(error.error || "Erro ao excluir funcionário")
      }
    } catch (error) {
      alert("Erro ao excluir funcionário")
    }
  }

  // Mostrar loading enquanto verifica autenticação
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  // Não renderizar nada se não estiver autenticado (será redirecionado)
  if (status !== "authenticated") {
    return null
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">Funcionários</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
            Gerencie os funcionários das consignatárias
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleNew} size="sm" className="flex-shrink-0">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Novo Funcionário</span>
            <span className="md:hidden">Novo</span>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funcionários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, matrícula ou status (ativo/inativo)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : funcionarios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum funcionário encontrado
            </div>
          ) : (
            <VirtualizedFuncionariosTable 
              funcionarios={funcionarios}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canView={canView}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
          
          {!loading && funcionarios.length > 0 && totalPages > 1 && (
            <div className="mt-4 pt-4 border-t">
              {/* Mobile: Layout em coluna */}
              <div className="flex flex-col gap-3 sm:hidden">
                <div className="text-xs text-center text-muted-foreground">
                  {((page - 1) * 50) + 1}-{Math.min(page * 50, total)} de {total}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex-1 max-w-[100px]"
                  >
                    ← Ant
                  </Button>
                  <div className="text-sm font-medium px-3 py-1 bg-muted rounded-md whitespace-nowrap">
                    {page}/{totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex-1 max-w-[100px]"
                  >
                    Prox →
                  </Button>
                </div>
              </div>
              
              {/* Desktop: Layout em linha */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * 50) + 1} a {Math.min(page * 50, total)} de {total} funcionários
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <div className="flex items-center gap-2 text-sm px-3 py-1 bg-muted rounded-md">
                    Página {page} de {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl h-auto md:h-[85vh] max-h-[90vh] overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedFuncionario ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do funcionário
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <Tabs defaultValue="pessoais" className="w-full flex flex-col flex-1 overflow-hidden">
              <TabsList className="grid w-full grid-cols-4 shrink-0">
                <TabsTrigger value="pessoais">Pessoais</TabsTrigger>
                <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
                <TabsTrigger value="financeiros">Financeiros</TabsTrigger>
                <TabsTrigger value="outros">Outros</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
              <TabsContent value="pessoais" className="space-y-4 py-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="empresaId">Consignatária *</Label>
                    <Select 
                      value={formData.empresaId} 
                      onValueChange={(value) => setFormData({ ...formData, empresaId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a consignatária" />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id.toString()}>
                            {empresa.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="matricula">Matrícula *</Label>
                    <Input
                      id="matricula"
                      value={formData.matricula}
                      onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rg">RG</Label>
                    <Input
                      id="rg"
                      value={formData.rg}
                      onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                    <Input
                      id="dataNascimento"
                      type="date"
                      value={formData.dataNascimento}
                      onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sexo">Sexo</Label>
                    <Select value={formData.sexo} onValueChange={(value) => setFormData({ ...formData, sexo: value })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estadoCivil">Estado Civil</Label>
                    <Select value={formData.estadoCivil} onValueChange={(value) => setFormData({ ...formData, estadoCivil: value })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="S">Solteiro(a)</SelectItem>
                        <SelectItem value="C">Casado(a)</SelectItem>
                        <SelectItem value="D">Divorciado(a)</SelectItem>
                        <SelectItem value="V">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="celular">Celular</Label>
                    <Input
                      id="celular"
                      value={formData.celular}
                      onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
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
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </TabsContent>

              <TabsContent value="profissionais" className="space-y-4 py-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="funcao">Função</Label>
                    <Input
                      id="funcao"
                      value={formData.funcao}
                      onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lotacao">Lotação/Setor</Label>
                    <Input
                      id="lotacao"
                      value={formData.lotacao}
                      onChange={(e) => setFormData({ ...formData, lotacao: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataCadastro">Data de Cadastro</Label>
                    <Input
                      id="dataCadastro"
                      type="date"
                      value={formData.dataCadastro}
                      onChange={(e) => setFormData({ ...formData, dataCadastro: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataAdmissao">Data de Admissão</Label>
                    <Input
                      id="dataAdmissao"
                      type="date"
                      value={formData.dataAdmissao}
                      onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contato">Contato Adicional</Label>
                  <Input
                    id="contato"
                    value={formData.contato}
                    onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autorizado">Pessoa Autorizada</Label>
                  <Input
                    id="autorizado"
                    value={formData.autorizado}
                    onChange={(e) => setFormData({ ...formData, autorizado: e.target.value })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="financeiros" className="space-y-4 py-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="limite">Limite de Crédito</Label>
                    <Input
                      id="limite"
                      type="number"
                      step="0.01"
                      value={formData.limite}
                      onChange={(e) => setFormData({ ...formData, limite: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="margemConsig">Margem Consignável</Label>
                    <Input
                      id="margemConsig"
                      type="number"
                      step="0.01"
                      value={formData.margemConsig}
                      onChange={(e) => setFormData({ ...formData, margemConsig: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gratificacao">Gratificação</Label>
                    <Input
                      id="gratificacao"
                      type="number"
                      step="0.01"
                      value={formData.gratificacao}
                      onChange={(e) => setFormData({ ...formData, gratificacao: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="banco">Banco</Label>
                    <Input
                      id="banco"
                      value={formData.banco}
                      onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agencia">Agência</Label>
                    <Input
                      id="agencia"
                      value={formData.agencia}
                      onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta">Conta</Label>
                    <Input
                      id="conta"
                      value={formData.conta}
                      onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numCompras">Número de Compras</Label>
                    <Input
                      id="numCompras"
                      type="number"
                      value={formData.numCompras}
                      onChange={(e) => setFormData({ ...formData, numCompras: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="devolucao">Devolução</Label>
                    <Input
                      id="devolucao"
                      type="number"
                      step="0.01"
                      value={formData.devolucao}
                      onChange={(e) => setFormData({ ...formData, devolucao: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="outros" className="space-y-4 py-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bloqueio">Bloqueio</Label>
                    <Select value={formData.bloqueio || "N"} onValueChange={(value) => setFormData({ ...formData, bloqueio: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N">Sem bloqueio</SelectItem>
                        <SelectItem value="X">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo</Label>
                    <Input
                      id="tipo"
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motivoBloqueio">Motivo do Bloqueio</Label>
                  <Input
                    id="motivoBloqueio"
                    value={formData.motivoBloqueio}
                    onChange={(e) => setFormData({ ...formData, motivoBloqueio: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataExclusao">Data de Exclusão</Label>
                    <Input
                      id="dataExclusao"
                      type="date"
                      value={formData.dataExclusao}
                      onChange={(e) => setFormData({ ...formData, dataExclusao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codTipo">Código Tipo</Label>
                    <Input
                      id="codTipo"
                      type="number"
                      value={formData.codTipo}
                      onChange={(e) => setFormData({ ...formData, codTipo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motivoExclusao">Motivo da Exclusão</Label>
                  <Input
                    id="motivoExclusao"
                    value={formData.motivoExclusao}
                    onChange={(e) => setFormData({ ...formData, motivoExclusao: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <Input
                      id="senha"
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end space-x-2 pb-2">
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
              </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="mt-6 shrink-0">
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

// Componente de tabela virtualizada para funcionários
function VirtualizedFuncionariosTable({ 
  funcionarios, 
  onEdit, 
  onDelete,
  canView,
  canEdit,
  canDelete
}: { 
  funcionarios: Funcionario[]
  onEdit: (funcionario: Funcionario) => void
  onDelete: (funcionario: Funcionario) => void
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
    count: funcionarios.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => isMobile ? 200 : 72,
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
              <div className="hidden md:grid md:grid-cols-[140px_2fr_200px_100px_110px] lg:grid-cols-[150px_2.5fr_220px_110px_120px] gap-3 lg:gap-4 p-3 font-medium text-sm">
                <div>Matrícula</div>
                <div>Nome</div>
                <div>Consignatária</div>
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
              const funcionario = funcionarios[virtualRow.index]
              
              // Verificar se o funcionário existe
              if (!funcionario) return null
              
              return (
                <div
                  key={funcionario.id}
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
                          {funcionario.nome}
                        </div>
                        {funcionario.matricula && (
                          <div className="text-xs text-muted-foreground mt-1 leading-tight">
                            Mat: {funcionario.matricula}
                          </div>
                        )}
                      </div>
                      {((canView || canEdit) || canDelete) && (
                        <div className="flex gap-1 flex-shrink-0">
                          {(canView || canEdit) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => onEdit(funcionario)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => onDelete(funcionario)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                        <span className="text-muted-foreground">Consignatária:</span>{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {funcionario.empresa?.nome || 'Não informada'}
                        </span>
                      </div>
                      
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground mr-2">Status:</span>
                        {funcionario.ativo ? (
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
                  <div className="hidden md:grid md:grid-cols-[140px_2fr_200px_100px_110px] lg:grid-cols-[150px_2.5fr_220px_110px_120px] gap-3 lg:gap-4 p-3 items-center text-sm">
                    <div className="font-mono text-xs">
                      {funcionario.matricula || (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </div>
                    
                    <div className="min-w-0 font-medium">
                      <div className="flex flex-col">
                        <span className="truncate">{funcionario.nome}</span>
                      </div>
                    </div>
                    
                    <div className="text-xs truncate">
                      {funcionario.empresa?.nome || 'Não informada'}
                    </div>
                    
                    <div>
                      {funcionario.ativo ? (
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
                            onClick={() => onEdit(funcionario)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(funcionario)}
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

"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  Mail,
  Crown,
  Upload,
  ImageIcon,
  X,
  Save,
  User,
  Shield,
} from "lucide-react"

interface ClienteData {
  id: string
  name: string
  email: string
  cpf?: string
  phone?: string
  active: boolean
  logo?: string | null
  permissions?: string[]
}

interface SubManager {
  id: string
  name: string
  email: string
  active: boolean
}

export default function ClienteEditPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const isNew = id === "novo"
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    active: true,
  })
  const [logo, setLogo] = useState<string | null>(null)
  const [subManagers, setSubManagers] = useState<SubManager[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [addingEmail, setAddingEmail] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clientePermissions, setClientePermissions] = useState<string[]>([])

  useEffect(() => {
    if (!isNew) {
      loadCliente()
      fetchSubManagers()
    }
  }, [id])

  async function loadCliente() {
    try {
      setLoading(true)
      const res = await fetch(`/api/usuarios/${id}`)
      if (!res.ok) {
        alert("Erro ao carregar cliente")
        router.push("/admin/clientes")
        return
      }
      const data: ClienteData = await res.json()
      setFormData({
        name: data.name,
        email: data.email,
        cpf: data.cpf || "",
        phone: data.phone || "",
        active: data.active,
      })
      setLogo(data.logo || null)
      setClientePermissions(data.permissions || [])
    } finally {
      setLoading(false)
    }
  }

  async function fetchSubManagers() {
    setLoadingSubs(true)
    try {
      const res = await fetch(`/api/usuarios?managerPrincipalId=${id}`)
      if (res.ok) {
        const data = await res.json()
        setSubManagers(
          data.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            active: u.active,
          }))
        )
      }
    } finally {
      setLoadingSubs(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const url = isNew ? "/api/usuarios" : `/api/usuarios/${id}`
      const method = isNew ? "POST" : "PUT"
      const body: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        cpf: formData.cpf || undefined,
        phone: formData.phone || undefined,
        active: formData.active,
        role: "MANAGER",
      }
      if (isNew) {
        body.permissions = []
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Erro ao salvar cliente")
        return
      }
      if (isNew) {
        const created = await res.json()
        router.push(`/admin/clientes/${created.id}`)
      } else {
        alert("Cliente salvo com sucesso!")
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || isNew) return

    if (file.size > 2 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 2MB.")
      return
    }

    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append("logo", file)
      const res = await fetch(`/api/usuarios/${id}/logo`, {
        method: "PUT",
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Erro ao fazer upload")
        return
      }
      const data = await res.json()
      setLogo(data.logo)
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleRemoveLogo() {
    if (!confirm("Remover a logomarca?")) return
    setUploadingLogo(true)
    try {
      const res = await fetch(`/api/usuarios/${id}/logo`, { method: "DELETE" })
      if (res.ok) {
        setLogo(null)
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleAddEmail() {
    if (!newEmail.trim() || !newName.trim()) return
    setAddingEmail(true)
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          role: "MANAGER",
          active: true,
          managerPrincipalId: id,
          permissions: clientePermissions,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Erro ao adicionar email")
        return
      }
      setNewName("")
      setNewEmail("")
      setShowAddForm(false)
      await fetchSubManagers()
    } finally {
      setAddingEmail(false)
    }
  }

  async function handleDeleteSub(subId: string) {
    if (!confirm("Remover este acesso? O usuário não conseguirá mais fazer login.")) return
    setDeletingId(subId)
    try {
      const res = await fetch(`/api/usuarios/${subId}`, { method: "DELETE" })
      if (res.ok) {
        await fetchSubManagers()
      } else {
        alert("Erro ao remover acesso")
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/clientes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {isNew ? "Novo Cliente" : formData.name || "Editar Cliente"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isNew
              ? "Preencha os dados para criar um novo cliente"
              : "Gerencie os dados, logomarca e acessos do cliente"}
          </p>
        </div>
        {!isNew && (
          <Badge
            variant={formData.active ? "default" : "secondary"}
            className={formData.active ? "bg-green-500 text-white" : ""}
          >
            {formData.active ? "Ativo" : "Inativo"}
          </Badge>
        )}
      </div>

      {isNew ? (
        /* Layout simples para novo cliente */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados do Cliente
            </CardTitle>
            <CardDescription>
              Após criar o cliente, você poderá adicionar a logomarca e emails de acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do cliente"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email principal *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    O cliente deverá usar &quot;Criar ou Redefinir Senha&quot; na tela de login para definir sua senha inicial.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(v) => setFormData({ ...formData, active: v })}
                />
                <Label htmlFor="active" className="cursor-pointer">Cliente ativo</Label>
              </div>
              <Separator />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.push("/admin/clientes")}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Criar Cliente</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Layout com tabs para edição */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Logo */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Logomarca
                </CardTitle>
                <CardDescription className="text-xs">
                  Imagem exibida nos portais vinculados ao cliente
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {/* Logo preview */}
                <div className="relative w-full aspect-square max-w-[200px] rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700">
                  {uploadingLogo ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : logo ? (
                    <>
                      <img
                        src={logo}
                        alt="Logo"
                        className="w-full h-full object-contain p-3"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute top-2 right-2 rounded-full bg-red-500 hover:bg-red-600 text-white p-1 shadow-md transition-colors"
                        title="Remover logo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground mt-2">Sem logomarca</p>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full max-w-[200px]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {logo ? "Trocar Logo" : "Enviar Logo"}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center">
                  PNG, JPG, WebP ou SVG. Máximo 2MB.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="dados" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dados" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados
                </TabsTrigger>
                <TabsTrigger value="acessos" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Acessos
                  {subManagers.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                      {subManagers.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Tab: Dados */}
              <TabsContent value="dados">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Informações do Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="name">Nome *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="email">Email principal *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cpf">CPF</Label>
                          <Input
                            id="cpf"
                            value={formData.cpf}
                            onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <Switch
                          id="active"
                          checked={formData.active}
                          onCheckedChange={(v) => setFormData({ ...formData, active: v })}
                        />
                        <Label htmlFor="active" className="cursor-pointer">Cliente ativo</Label>
                      </div>

                      <Separator />

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => router.push("/admin/clientes")}>
                          Voltar
                        </Button>
                        <Button type="submit" disabled={saving}>
                          {saving ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                          ) : (
                            <><Save className="h-4 w-4 mr-2" />Salvar</>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Acessos */}
              <TabsContent value="acessos">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Emails de Acesso</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Múltiplos logins para o mesmo cliente e seus dados
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddForm(!showAddForm)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Formulário inline para novo email */}
                    {showAddForm && (
                      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nome do responsável *</Label>
                            <Input
                              placeholder="Ex: Maria Silva"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Email *</Label>
                            <Input
                              type="email"
                              placeholder="email@exemplo.com"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              className="h-9"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            O novo acesso deve usar &quot;Criar ou Redefinir Senha&quot; para primeiro login.
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowAddForm(false)
                                setNewName("")
                                setNewEmail("")
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAddEmail}
                              disabled={addingEmail || !newEmail.trim() || !newName.trim()}
                            >
                              {addingEmail ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Confirmar"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Email principal */}
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-blue-50/50 dark:bg-blue-950/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 h-9 w-9">
                          <Crown className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{formData.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{formData.email}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0 ml-2">Principal</Badge>
                    </div>

                    {/* Sub-managers */}
                    {loadingSubs ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando acessos...
                      </div>
                    ) : subManagers.length === 0 ? (
                      <p className="text-xs text-center text-muted-foreground py-6">
                        Nenhum acesso adicional cadastrado. Clique em &quot;Adicionar&quot; para criar.
                      </p>
                    ) : (
                      subManagers.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 h-9 w-9">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{sub.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{sub.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            {!sub.active && (
                              <Badge variant="secondary" className="text-xs">Inativo</Badge>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={() => handleDeleteSub(sub.id)}
                              disabled={!!deletingId}
                              title="Remover este acesso"
                            >
                              {deletingId === sub.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  )
}

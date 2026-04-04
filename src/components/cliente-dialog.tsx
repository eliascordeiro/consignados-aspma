"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Trash2, Plus, Mail, Crown } from "lucide-react"

interface Cliente {
  id: string
  name: string
  email: string
  cpf?: string
  phone?: string
  active: boolean
  permissions?: string[]
}

interface SubManager {
  id: string
  name: string
  email: string
  active: boolean
}

interface ClienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente?: Cliente | null
  onSuccess: () => void
}

export function ClienteDialog({ open, onOpenChange, cliente, onSuccess }: ClienteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    phone: "",
    active: true,
  })

  const [subManagers, setSubManagers] = useState<SubManager[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [addingEmail, setAddingEmail] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (cliente) {
      setFormData({
        name: cliente.name,
        email: cliente.email,
        cpf: cliente.cpf || "",
        phone: cliente.phone || "",
        active: cliente.active,
      })
      fetchSubManagers()
    } else {
      setFormData({ name: "", email: "", cpf: "", phone: "", active: true })
      setSubManagers([])
    }
    setShowAddForm(false)
    setNewName("")
    setNewEmail("")
  }, [cliente, open])

  async function fetchSubManagers() {
    if (!cliente) return
    setLoadingSubs(true)
    try {
      const res = await fetch(`/api/usuarios?managerPrincipalId=${cliente.id}`)
      if (res.ok) {
        const data = await res.json()
        setSubManagers(data)
      }
    } finally {
      setLoadingSubs(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = cliente ? `/api/usuarios/${cliente.id}` : "/api/usuarios"
      const method = cliente ? "PUT" : "POST"
      const body: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        cpf: formData.cpf || undefined,
        phone: formData.phone || undefined,
        active: formData.active,
        role: "MANAGER",
      }
      if (!cliente) {
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
      onSuccess()
      if (!cliente) onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddEmail() {
    if (!cliente || !newEmail.trim() || !newName.trim()) return
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
          managerPrincipalId: cliente.id,
          permissions: cliente.permissions || [],
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

  async function handleDeleteSub(id: string) {
    if (!confirm("Remover este acesso? O usuário não conseguirá mais fazer login.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" })
      if (res.ok) {
        await fetchSubManagers()
      } else {
        alert("Erro ao remover acesso")
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>
            {cliente
              ? "Atualize os dados e gerencie os emails de acesso ao sistema"
              : "Preencha os dados para criar um novo cliente"}
          </DialogDescription>
        </DialogHeader>

        {/* Formulário principal */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email principal *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            {!cliente && (
              <p className="text-xs text-muted-foreground">
                ℹ️ O cliente deverá usar &quot;Criar ou Redefinir Senha&quot; na tela de login para definir sua senha inicial.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="flex items-center gap-3">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(v) => setFormData({ ...formData, active: v })}
            />
            <Label htmlFor="active" className="cursor-pointer">Cliente ativo</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>

        {/* Seção de emails de acesso — só aparece ao editar */}
        {cliente && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Emails de Acesso</h3>
                <p className="text-xs text-muted-foreground">
                  Múltiplos logins para o mesmo cliente e seus dados
                </p>
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

            {/* Formulário inline para novo email */}
            {showAddForm && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do responsável *</Label>
                    <Input
                      placeholder="Ex: Maria Silva"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email *</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="h-8 text-sm"
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
              <div className="flex items-center gap-2 min-w-0">
                <Crown className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{formData.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{cliente.email}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0 ml-2">Principal</Badge>
            </div>

            {/* Sub-managers */}
            {loadingSubs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando acessos...
              </div>
            ) : subManagers.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-3">
                Nenhum acesso adicional cadastrado. Clique em &quot;Adicionar&quot; para criar.
              </p>
            ) : (
              subManagers.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
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
                      className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

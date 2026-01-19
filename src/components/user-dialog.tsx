"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { PERMISSION_MODULES, AVAILABLE_PERMISSIONS } from "@/config/permissions"
import { Badge } from "@/components/ui/badge"

interface User {
  id: string
  name: string
  email: string
  role: string
  cpf?: string
  phone?: string
  active: boolean
  permissions?: string[]
}

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: User | null
  onSuccess: () => void
  defaultRole?: string
}

export function UserDialog({ open, onOpenChange, user, onSuccess, defaultRole }: UserDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
    cpf: "",
    phone: "",
    active: true,
    permissions: [] as string[],
  })

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role,
        cpf: user.cpf || "",
        phone: user.phone || "",
        active: user.active,
        permissions: user.permissions || [],
      })
    } else {
      setFormData({
        name: "",
        email: "",
        password: "",
        role: defaultRole || "USER",
        cpf: "",
        phone: "",
        active: true,
        permissions: defaultRole === "MANAGER" ? AVAILABLE_PERMISSIONS.map(p => p.id) : [],
      })
    }
  }, [user, defaultRole])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = user
        ? `/api/usuarios/${user.id}`
        : "/api/usuarios"
      
      const method = user ? "PUT" : "POST"
      
      // Preparar dados - só incluir permissions se for MANAGER
      const submitData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        cpf: formData.cpf,
        phone: formData.phone,
        active: formData.active,
      }

      // Adicionar senha se fornecida
      if (formData.password) {
        submitData.password = formData.password
      }

      // Adicionar permissions apenas para MANAGER
      if (formData.role === "MANAGER") {
        submitData.permissions = formData.permissions
      }
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Erro ao salvar usuário")
        return
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      alert("Erro ao salvar usuário")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Atualize as informações do usuário"
              : "Preencha os dados para criar um novo usuário"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {formData.role !== "MANAGER" && (
              <div className="grid gap-2">
                <Label htmlFor="password">
                  Senha {user ? "(deixe em branco para manter)" : "*"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!user}
                />
              </div>
            )}

            {formData.role === "MANAGER" && !user && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ℹ️ O cliente receberá um email e deverá usar "Esqueceu sua senha" para criar a senha inicial.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="role">Função *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="MANAGER">Gerente</SelectItem>
                  <SelectItem value="OPERATOR">Operador</SelectItem>
                  <SelectItem value="USER">Usuário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {formData.role === "MANAGER" && (
              <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Permissões de Acesso</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dashboard está sempre disponível. Configure permissões específicas por módulo.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ 
                        ...formData, 
                        permissions: AVAILABLE_PERMISSIONS.map(p => p.id) 
                      })}
                    >
                      Selecionar Todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, permissions: [] })}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 mt-2">
                  {PERMISSION_MODULES.map((module) => {
                    const ModuleIcon = module.icon
                    const modulePermissions = module.permissions
                    const allModuleSelected = modulePermissions.every(p => formData.permissions.includes(p.id))
                    const someModuleSelected = modulePermissions.some(p => formData.permissions.includes(p.id))
                    
                    return (
                      <div key={module.id} className="border rounded-lg p-3 bg-background">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b">
                          <div className="flex items-center gap-2">
                            <ModuleIcon className="h-5 w-5 text-primary" />
                            <Label className="text-sm font-semibold">{module.name}</Label>
                            {someModuleSelected && (
                              <Badge variant="secondary" className="text-xs">
                                {modulePermissions.filter(p => formData.permissions.includes(p.id)).length}/{modulePermissions.length}
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (allModuleSelected) {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter(
                                    p => !modulePermissions.find(mp => mp.id === p)
                                  )
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: [...new Set([
                                    ...formData.permissions,
                                    ...modulePermissions.map(p => p.id)
                                  ])]
                                })
                              }
                            }}
                          >
                            {allModuleSelected ? "Desmarcar Todos" : "Marcar Todos"}
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {modulePermissions.map((permission) => {
                            const PermIcon = permission.icon
                            return (
                              <div
                                key={permission.id}
                                className="flex items-start space-x-2 p-2 rounded hover:bg-muted/30 transition-colors"
                              >
                                <Checkbox
                                  id={permission.id}
                                  checked={formData.permissions.includes(permission.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({
                                        ...formData,
                                        permissions: [...formData.permissions, permission.id]
                                      })
                                    } else {
                                      setFormData({
                                        ...formData,
                                        permissions: formData.permissions.filter(p => p !== permission.id)
                                      })
                                    }
                                  }}
                                />
                                <div className="flex-1">
                                  <label
                                    htmlFor={permission.id}
                                    className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                                  >
                                    {PermIcon && <PermIcon className="h-3.5 w-3.5" />}
                                    {permission.name}
                                  </label>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {permission.description}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

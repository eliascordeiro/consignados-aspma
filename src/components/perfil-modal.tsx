"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
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
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface PerfilModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PerfilModal({ open, onOpenChange }: PerfilModalProps) {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validações
      if (!formData.name.trim()) {
        toast.error("Nome é obrigatório")
        setLoading(false)
        return
      }

      if (!formData.email.trim()) {
        toast.error("Email é obrigatório")
        setLoading(false)
        return
      }

      // Se está alterando senha, validar campos
      if (formData.newPassword || formData.confirmPassword || formData.currentPassword) {
        if (!formData.currentPassword) {
          toast.error("Informe a senha atual para alterar a senha")
          setLoading(false)
          return
        }

        if (!formData.newPassword) {
          toast.error("Informe a nova senha")
          setLoading(false)
          return
        }

        if (formData.newPassword.length < 6) {
          toast.error("A nova senha deve ter no mínimo 6 caracteres")
          setLoading(false)
          return
        }

        if (formData.newPassword !== formData.confirmPassword) {
          toast.error("As senhas não coincidem")
          setLoading(false)
          return
        }
      }

      // Montar payload
      const payload: any = {
        name: formData.name,
        email: formData.email,
      }

      if (formData.currentPassword && formData.newPassword) {
        payload.currentPassword = formData.currentPassword
        payload.newPassword = formData.newPassword
      }

      const response = await fetch("/api/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || "Erro ao atualizar perfil")
        setLoading(false)
        return
      }

      // Atualizar sessão com novos dados
      await update({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
          email: formData.email,
        },
      })

      toast.success("Perfil atualizado com sucesso!")
      
      // Limpar campos de senha
      setFormData({
        ...formData,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error)
      toast.error("Erro ao atualizar perfil")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Atualize seus dados pessoais e senha
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Alterar Senha (opcional)</h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    placeholder="Digite sua senha atual"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    placeholder="Digite a nova senha"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirme a nova senha"
                  />
                </div>
              </div>
            </div>
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
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, AlertTriangle } from "lucide-react"

export default function ConvenioAlterarSenhaPage() {
  const [form, setForm] = useState({ currentSenha: "", newSenha: "", confirmSenha: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (form.newSenha !== form.confirmSenha) {
      setError("A nova senha e a confirmação não coincidem.")
      return
    }

    if (form.newSenha.length < 4) {
      setError("A nova senha deve ter pelo menos 4 caracteres.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/convenio/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSenha: form.currentSenha,
          newSenha: form.newSenha,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.error === "conta_bloqueada") {
          setError("HARD_LOCK")
        } else {
          setError(data.error || "Erro ao alterar a senha.")
        }
        return
      }

      // Full page reload to pick up the new convenio_session cookie
      window.location.href = "/convenio/dashboard"
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Renovação de Senha</CardTitle>
          </div>
          <CardDescription>
            Por segurança, a senha deve ser renovada mensalmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Sua senha expirou ou ainda não foi cadastrada. Defina uma nova senha para continuar.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentSenha">Senha atual</Label>
              <Input
                id="currentSenha"
                type="password"
                value={form.currentSenha}
                onChange={(e) => setForm((f) => ({ ...f, currentSenha: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newSenha">Nova senha</Label>
              <Input
                id="newSenha"
                type="password"
                value={form.newSenha}
                onChange={(e) => setForm((f) => ({ ...f, newSenha: e.target.value }))}
                required
                minLength={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmSenha">Confirmar nova senha</Label>
              <Input
                id="confirmSenha"
                type="password"
                value={form.confirmSenha}
                onChange={(e) => setForm((f) => ({ ...f, confirmSenha: e.target.value }))}
                required
                minLength={4}
              />
            </div>

            {error === "HARD_LOCK" ? (
              <div className="rounded-md border border-red-500/50 bg-red-500/10 p-4 text-sm">
                <p className="font-semibold text-red-700 dark:text-red-400 mb-1">
                  Conta bloqueada por inatividade.
                </p>
                <p className="text-red-600 dark:text-red-300">
                  A senha não foi renovada por mais de 60 dias. Entre em contato com o administrador
                  do sistema para reativar este acesso.
                </p>
              </div>
            ) : error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

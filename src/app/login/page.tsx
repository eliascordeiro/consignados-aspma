"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Lock, AlertCircle, User } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function onSubmitAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const login = formData.get("login") as string
    const password = formData.get("password") as string

    try {
      const result = await signIn("credentials", {
        login,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Credenciais inválidas")
      } else {
        // Buscar sessão para verificar isConvenio
        const response = await fetch("/api/auth/session")
        const session = await response.json()
        
        console.log("📍 Session após login:", session)
        
        // PRIORIDADE 1: Se session indica que é conveniado, redirecionar para convenio
        if (session?.user?.isConvenio) {
          console.log("📍 Redirecionando conveniado para portal (via session.isConvenio)")
          window.location.href = "/convenio/dashboard"
          return
        }

        // PRIORIDADE 2: Verificar cookie convenio_session
        const convenioCheck = await fetch("/api/convenio/check")
        const convenioData = await convenioCheck.json()
        
        if (convenioData?.isConvenio) {
          console.log("📍 Redirecionando conveniado para portal (via cookie)")
          window.location.href = "/convenio/dashboard"
          return
        }
        
        // PRIORIDADE 3: Redirecionamento por role (apenas se NÃO for conveniado)
        if (session?.user?.role === "ADMIN") {
          window.location.href = "/dashboard"
        } else if (session?.user?.role === "MANAGER" || session?.user?.role === "USER") {
          window.location.href = "/cliente/dashboard"
        } else {
          window.location.href = "/dashboard"
        }
      }
    } catch (error) {
      setError("Erro ao fazer login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Login form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-white dark:bg-gray-950">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {/* Theme toggle */}
          <div className="flex justify-end mb-4">
            <ThemeToggle />
          </div>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <CreditCard style={{ color: '#ffffff', width: '28px', height: '28px' }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                A.S.P.M.A
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gestor de Consignados</p>
            </div>
          </div>

          {/* Form */}
          <div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Bem-vindo de volta</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Entre com suas credenciais para acessar o sistema
              </p>
            </div>

            <form onSubmit={onSubmitAdmin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="login" className="text-sm font-medium">
                  Usuário ou Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login"
                    name="login"
                    type="text"
                    placeholder="usuario ou email"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Criar ou Redefinir Senha
                </Link>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: '2.25rem',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  fontWeight: '600',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                  boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#4f46e5')}
                onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#6366f1')}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              <p>© 2026 A.S.P.M.A - Associação dos Servidores Municipais de Araucária</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Gradient background (hidden on mobile) */}
      <div className="relative hidden lg:block lg:flex-1 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 dark:from-emerald-500 dark:via-teal-500 dark:to-green-600">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/0" />
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-md text-center space-y-6 p-8">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <CreditCard style={{ color: '#ffffff', width: '48px', height: '48px' }} />
                </div>
              </div>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#ffffff', textShadow: '0 4px 12px rgba(0,0,0,0.5)', lineHeight: '1.2' }}>
                Gestão de Margem Consignada
              </h2>
              <p style={{ fontSize: '1.125rem', color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.4)', lineHeight: '1.6' }}>
                Sistema completo para controle de crédito consignado dos servidores municipais
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

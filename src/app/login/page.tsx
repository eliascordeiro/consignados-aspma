"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Lock, Mail, AlertCircle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Credenciais inválidas")
      } else {
        router.push("/dashboard")
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
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <CreditCard style={{ color: '#ffffff', width: '28px', height: '28px' }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ConsigExpress
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Plataforma de Consignados</p>
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

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
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
              <p>© 2026 ConsigExpress. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Gradient background (hidden on mobile) */}
      <div className="relative hidden lg:block lg:flex-1 bg-gradient-to-br from-blue-700 via-purple-700 to-pink-700 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500">
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
                Gerencie consignados com facilidade
              </h2>
              <p style={{ fontSize: '1.125rem', color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.4)', lineHeight: '1.6' }}>
                Plataforma completa para gestão de descontos em folha de pagamento
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

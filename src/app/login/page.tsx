"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Lock, AlertCircle, User, Fingerprint, Loader2, ShieldCheck } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { startAuthentication } from "@simplewebauthn/browser"

// ── Helpers de redirecionamento ───────────────────────────────────────────────
async function redirectAfterLogin() {
  const response = await fetch("/api/auth/session")
  const session = await response.json()

  if (session?.user?.isConvenio) {
    window.location.href = "/convenio/dashboard"
    return
  }
  const convenioCheck = await fetch("/api/convenio/check")
  const convenioData = await convenioCheck.json()
  if (convenioData?.isConvenio) {
    window.location.href = "/convenio/dashboard"
    return
  }
  if (session?.user?.role === "ADMIN") {
    window.location.href = "/dashboard"
  } else if (session?.user?.role === "MANAGER" || session?.user?.role === "USER") {
    window.location.href = "/cliente/dashboard"
  } else {
    window.location.href = "/dashboard"
  }
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Estado do fluxo MFA (biometria como 2º fator)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [pendingLogin, setPendingLogin] = useState("")
  const [pendingPassword, setPendingPassword] = useState("")

  // ── Login standalone com biometria (sem senha) ────────────────────────────
  async function handleBiometricLogin() {
    setError("")
    setMfaLoading(true)
    try {
      // Se o usuário já digitou o login, passa para o servidor filtrar
      // apenas as credenciais daquele usuário (evita lista acumulada no browser)
      const loginField = document.querySelector<HTMLInputElement>('#login')?.value?.trim()
      const optRes = await fetch("/api/auth/webauthn/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginField ? { username: loginField } : {}),
      })
      if (!optRes.ok) {
        setError("Nenhuma biometria cadastrada para este dispositivo.")
        return
      }
      const options = await optRes.json()
      const authResponse = await startAuthentication({ optionsJSON: options })
      const verifyRes = await fetch("/api/auth/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      })
      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || "Falha na verificação biométrica.")
        return
      }
      const { faceToken } = await verifyRes.json()
      const result = await signIn("credentials", { faceToken, redirect: false })
      if (result?.error) {
        setError("Autenticação biométrica falhou. Tente com senha.")
        return
      }
      await redirectAfterLogin()
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setError("Autenticação cancelada pelo usuário.")
      } else {
        setError("Biometria não disponível. Use sua senha.")
      }
    } finally {
      setMfaLoading(false)
    }
  }

  // ── MFA: confirmar biometria após senha válida ─────────────────────────────
  async function handleMfaConfirm() {
    setError("")
    setMfaLoading(true)
    try {
      // Passa o login para o servidor restringir ao allowCredentials do usuário
      // — o browser mostra apenas as passkeys cadastradas no banco, não a lista acumulada
      const optRes = await fetch("/api/auth/webauthn/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: pendingLogin }),
      })
      if (!optRes.ok) {
        setError("Erro ao iniciar biometria. Tente novamente.")
        return
      }
      const options = await optRes.json()
      const authResponse = await startAuthentication({ optionsJSON: options })
      const verifyRes = await fetch("/api/auth/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      })
      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || "Falha na verificação biométrica.")
        return
      }
      const { faceToken } = await verifyRes.json()

      // Re-submete com senha + faceToken (ambos validados no servidor)
      const result = await signIn("credentials", {
        login: pendingLogin,
        password: pendingPassword,
        faceToken,
        redirect: false,
      })
      if (result?.error) {
        // Senha digitada era inválida (biometria passou, mas senha não)
        setError("Senha incorreta. Clique em 'Cancelar' e tente novamente com a senha correta.")
        return
      }
      await redirectAfterLogin()
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setError("Autenticação cancelada. Tente novamente.")
      } else {
        setError("Erro na biometria. Tente novamente.")
      }
    } finally {
      setMfaLoading(false)
    }
  }

  function handleCancelMfa() {
    setMfaRequired(false)
    setPendingLogin("")
    setPendingPassword("")
    setError("")
  }

  // ── Login com senha ────────────────────────────────────────────────────────
  async function onSubmitAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const login = formData.get("login") as string
    const password = formData.get("password") as string

    try {
      const result = await signIn("credentials", { login, password, redirect: false })

      if (result?.error) {
        // 1. Rate limit explícito no código
        if (result.error.startsWith('rate_limit_')) {
          const min = parseInt(result.error.replace('rate_limit_', '')) || 1
          setError(`Muitas tentativas. Aguarde ${min} minuto${min > 1 ? 's' : ''} e tente novamente.`)
          return
        }

        // 2. Verificar rate limit via API
        //    NextAuth beta.30 pode não propagar o code customizado, então checamos pelo endpoint
        try {
          const rl = await fetch(`/api/auth/rate-limit-status?login=${encodeURIComponent(login)}`)
          const rlData = await rl.json()
          if (rlData?.blocked) {
            const min = rlData.minutosRestantes || 1
            setError(`Muitas tentativas. Aguarde ${min} minuto${min > 1 ? 's' : ''} e tente novamente.`)
            return
          }
        } catch { /* ignora erro de rede */ }

        // 3. Verificar se é MFA obrigatório (webauthn_required)
        //    — NextAuth beta.30 normaliza CredentialsSignin subclasses para "CredentialsSignin",
        //      então verificamos o cadastro de biometria diretamente via API
        const possibleMfa =
          result.error === 'webauthn_required' ||
          result.error.includes('webauthn_required') ||
          result.error === 'CredentialsSignin'

        if (possibleMfa) {
          try {
            const enrolledRes = await fetch(
              `/api/auth/webauthn/check-enrolled?login=${encodeURIComponent(login)}`
            )
            const enrolledData = await enrolledRes.json()
            if (enrolledData?.enrolled) {
              setPendingLogin(login)
              setPendingPassword(password)
              setMfaRequired(true)
              return
            }
          } catch { /* ignora erro de rede */ }
        }

        // 4. Verificar se convênio está inativo (login falhou porque convênio foi desativado)
        try {
          const inativoRes = await fetch(
            `/api/convenio/check-ativo?login=${encodeURIComponent(login)}`
          )
          const inativoData = await inativoRes.json()
          if (inativoData?.inativo) {
            window.location.href = '/convenio/bloqueado'
            return
          }
        } catch { /* ignora erro de rede */ }

        // 5. Credenciais genuinamente inválidas
        setError("Usuário ou senha inválidos")
      } else {
        await redirectAfterLogin()
      }
    } catch {
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

          {/* Tela MFA — biometria como 2º fator */}
          {mfaRequired ? (
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto h-20 w-20 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-4 border-2 border-emerald-200 dark:border-emerald-800">
                  {mfaLoading
                    ? <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                    : <ShieldCheck className="h-10 w-10 text-emerald-600" />
                  }
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirme sua identidade</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Senha verificada. Complete o login com sua biometria cadastrada.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-600 dark:text-red-400 mb-4">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleMfaConfirm}
                disabled={mfaLoading}
                style={{
                  width: '100%',
                  height: '2.5rem',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: '600',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: mfaLoading ? 'not-allowed' : 'pointer',
                  opacity: mfaLoading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9375rem',
                  boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => !mfaLoading && (e.currentTarget.style.backgroundColor = '#047857')}
                onMouseLeave={(e) => !mfaLoading && (e.currentTarget.style.backgroundColor = '#059669')}
              >
                {mfaLoading
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Aguardando biometria...</>
                  : <><Fingerprint className="h-5 w-5" /> Confirmar com Face ID / Biometria</>
                }
              </button>

              <button
                type="button"
                onClick={handleCancelMfa}
                disabled={mfaLoading}
                style={{
                  marginTop: '0.75rem',
                  width: '100%',
                  height: '2.25rem',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  fontWeight: '500',
                  borderRadius: '0.375rem',
                  border: '1.5px solid #d1d5db',
                  cursor: mfaLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancelar e usar outra conta
              </button>

              <p className="mt-5 text-xs text-muted-foreground">
                Use Face ID, Windows Hello, Touch ID ou chave de segurança
              </p>
            </div>
          ) : (
          /* Tela normal de login com senha */
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
                disabled={isLoading || mfaLoading}
                style={{
                  width: '100%',
                  height: '2.25rem',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  fontWeight: '600',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: (isLoading || mfaLoading) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || mfaLoading) ? 0.5 : 1,
                  boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => !(isLoading || mfaLoading) && (e.currentTarget.style.backgroundColor = '#4f46e5')}
                onMouseLeave={(e) => !(isLoading || mfaLoading) && (e.currentTarget.style.backgroundColor = '#6366f1')}
              >
                {isLoading ? "Verificando..." : "Entrar"}
              </button>

              {/* Separador */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-950 px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              {/* Botão biometria standalone */}
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={isLoading || mfaLoading}
                title="Entrar com biometria (Face ID, Windows Hello, Digital)"
                style={{
                  width: '100%',
                  height: '2.25rem',
                  backgroundColor: 'transparent',
                  color: 'currentColor',
                  fontWeight: '500',
                  borderRadius: '0.375rem',
                  border: '1.5px solid #d1d5db',
                  cursor: (isLoading || mfaLoading) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || mfaLoading) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                }}
              >
                {mfaLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando biometria...</>
                  : <><Fingerprint className="h-4 w-4 text-emerald-600" /> Entrar com Biometria</>
                }
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              <p>© 2026 A.S.P.M.A - Associação dos Servidores Municipais de Araucária</p>
            </div>
          </div>
          )}
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

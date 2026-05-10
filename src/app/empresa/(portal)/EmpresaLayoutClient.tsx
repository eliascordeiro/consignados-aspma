'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import EmpresaNav from './EmpresaNav'
import { Building2, Landmark, FlaskConical, Shield, LogOut, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeSwitcher } from '@/components/theme-switcher'

interface EmpresaLayoutClientProps {
  children: React.ReactNode
  nome: string
  cnpj: string | null
  email: string | null
  cidade: string | null
  uf: string | null
  tipo: string | null
  passwordDaysLeft?: number | null
  managerLogo?: string | null
}

function getTipoInfo(tipo: string | null) {
  if (!tipo) return { Icon: Building2, label: 'Consignatária' }
  const t = tipo.toLowerCase()
  if (t === 'publico') return { Icon: Landmark, label: 'Órgão Público' }
  if (t === 'privado') return { Icon: Building2, label: 'Empresa Privada' }
  if (t === 'misto') return { Icon: Shield, label: 'Misto' }
  if (t === 'teste') return { Icon: FlaskConical, label: 'Teste' }
  return { Icon: Building2, label: 'Consignatária' }
}

function EmpresaLogoutButton() {
  const handleLogout = async () => {
    const response = await fetch('/api/auth/logout-empresa', { method: 'POST' })
    if (response.ok) {
      window.location.href = '/login'
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      <LogOut className="h-4 w-4 mr-2" />
      Sair
    </Button>
  )
}

export default function EmpresaLayoutClient({
  children,
  nome,
  cnpj,
  email,
  cidade,
  uf,
  tipo,
  passwordDaysLeft,
  managerLogo,
}: EmpresaLayoutClientProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false },
        },
      })
  )

  const { Icon: TipoIcon, label: tipoLabel } = getTipoInfo(tipo)

  // Formata CNPJ se existir
  const cnpjFormatado = cnpj
    ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : null

  const localizacao = [cidade, uf].filter(Boolean).join(' - ')

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Stripe roxo para diferenciar da consignante (azul) e do convênio */}
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-600 to-indigo-600 w-full" />

        {/* Header */}
        <header className="bg-card shadow-sm border-b border-border">
          <div className="container mx-auto px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {managerLogo ? (
                  <div className="p-1 bg-white rounded-lg flex-shrink-0 border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={managerLogo}
                      alt="Logo"
                      className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-1.5 sm:p-2 bg-violet-500/15 rounded-lg flex-shrink-0">
                    <TipoIcon className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl font-bold text-foreground truncate">
                    {nome}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                      Portal da Consignatária
                    </p>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300">
                      {tipoLabel}
                    </span>
                    {cnpjFormatado && (
                      <span className="hidden md:inline text-[11px] text-muted-foreground">
                        CNPJ: {cnpjFormatado}
                      </span>
                    )}
                    {localizacao && (
                      <span className="hidden md:inline text-[11px] text-muted-foreground">
                        • {localizacao}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <ThemeSwitcher />
                <EmpresaLogoutButton />
              </div>
            </div>
          </div>
        </header>

        <EmpresaNav />

        {/* Banner de expiração de senha */}
        {passwordDaysLeft !== null &&
          passwordDaysLeft !== undefined &&
          passwordDaysLeft <= 5 && (
            <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {passwordDaysLeft <= 1
                    ? 'Sua senha expira amanhã!'
                    : `Sua senha expira em ${passwordDaysLeft} dia${passwordDaysLeft !== 1 ? 's' : ''}.`}{' '}
                  Renove agora para não perder o acesso.
                </span>
              </div>
              <a
                href="/empresa/alterar-senha"
                className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
              >
                Renovar agora
              </a>
            </div>
          )}

        <main className="flex-1 container mx-auto px-4 py-6">{children}</main>

        <footer className="border-t border-border bg-card">
          <div className="container mx-auto px-4 py-4 text-center text-xs sm:text-sm text-muted-foreground">
            © 2026 Sistema de Consignados — Portal da Consignatária
            {email && <span className="hidden sm:inline"> • {email}</span>}
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  )
}

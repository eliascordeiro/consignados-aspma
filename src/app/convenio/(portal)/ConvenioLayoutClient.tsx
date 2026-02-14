'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import ConvenioNav from './ConvenioNav'
import { Building2, Landmark, Store, FlaskConical, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeSwitcher } from '@/components/theme-switcher'

interface ConvenioLayoutClientProps {
  children: React.ReactNode
  fantasia: string | null
  razaoSocial: string | null
  tipo: string | null
}

// Mapeia o tipo do convênio para a classe CSS de categoria
function getCategoriaClass(tipo: string | null): string {
  if (!tipo) return ''
  const t = tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (t === 'banco') return 'categoria-banco'
  if (t === 'comercio') return 'categoria-comercio'
  if (t === 'teste') return 'categoria-teste'
  return ''
}

// Mapeia o tipo para ícone e label
function getCategoriaInfo(tipo: string | null) {
  if (!tipo) return { Icon: Building2, label: 'Conveniado' }
  const t = tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (t === 'banco') return { Icon: Landmark, label: 'Banco' }
  if (t === 'comercio') return { Icon: Store, label: 'Comércio' }
  if (t === 'teste') return { Icon: FlaskConical, label: 'Teste' }
  return { Icon: Building2, label: tipo }
}

function ConvenioLogoutButton() {
  const handleLogout = async () => {
    const response = await fetch('/api/auth/logout-convenio', {
      method: 'POST',
    })
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

export default function ConvenioLayoutClient({
  children,
  fantasia,
  razaoSocial,
  tipo,
}: ConvenioLayoutClientProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const categoriaClass = getCategoriaClass(tipo)
  const { Icon: CategoriaIcon, label: categoriaLabel } = getCategoriaInfo(tipo)

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`min-h-screen flex flex-col bg-background ${categoriaClass}`}>
        {/* Stripe de categoria no topo */}
        <div className="h-1 bg-primary w-full" />

        {/* Header */}
        <header className="bg-card shadow-sm border-b border-border">
          <div className="container mx-auto px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 bg-primary/15 rounded-lg flex-shrink-0">
                  <CategoriaIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl font-bold text-foreground truncate">
                    {fantasia || razaoSocial}
                  </h1>
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                      Portal do Conveniado
                    </p>
                    {tipo && (
                      <span
                        className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full"
                        style={{
                          backgroundColor: 'var(--categoria-badge-bg, var(--muted))',
                          color: 'var(--categoria-badge-text, var(--muted-foreground))',
                        }}
                      >
                        {categoriaLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <ThemeSwitcher />
                <ConvenioLogoutButton />
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <ConvenioNav />

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6">{children}</main>

        {/* Footer */}
        <footer className="border-t border-border bg-card">
          <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
            © 2026 Sistema de Consignados - Portal do Conveniado
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  )
}

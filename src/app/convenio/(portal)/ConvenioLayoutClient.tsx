'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import ConvenioNav from './ConvenioNav'
import { Building2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeSwitcher } from '@/components/theme-switcher'

interface ConvenioLayoutClientProps {
  children: React.ReactNode
  fantasia: string | null
  razaoSocial: string | null
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
}: ConvenioLayoutClientProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuto
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {fantasia || razaoSocial}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Portal do Conveniado
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
        <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            © 2026 Sistema de Consignados - Portal do Conveniado
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  )
}

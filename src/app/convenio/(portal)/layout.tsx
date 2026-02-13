import { redirect } from 'next/navigation'
import { getConvenioSession } from '@/lib/convenio-auth'
import { Building2, LogOut, Home, ShoppingCart, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

async function ConvenioLogoutButton() {
  return (
    <form action={async () => {
      'use server'
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      cookieStore.delete('convenio_session')
      redirect('/convenio/login')
    }}>
      <Button variant="ghost" size="sm" type="submit">
        <LogOut className="h-4 w-4 mr-2" />
        Sair
      </Button>
    </form>
  )
}

export default async function ConvenioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getConvenioSession()

  if (!session) {
    redirect('/convenio/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
                  {session.fantasia || session.razaoSocial}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Portal do Conveniado
                </p>
              </div>
            </div>
            <ConvenioLogoutButton />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            <Link
              href="/convenio/dashboard"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/convenio/vendas"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Vendas
            </Link>
            <Link
              href="/convenio/relatorios"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          © 2026 Sistema de Consignados - Portal do Conveniado
        </div>
      </footer>
    </div>
  )
}

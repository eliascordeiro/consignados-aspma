"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  LayoutDashboard, 
  Building2,
  Users,
  Store,
  LogOut,
  Menu,
  X,
  CreditCard
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { getUserModules } from "@/config/permissions"

// Dashboard é sempre visível, outros módulos baseados em permissões
const dashboardNav = { name: "Dashboard", href: "/cliente/dashboard", icon: LayoutDashboard }
const moduleRoutes: Record<string, { name: string; href: string; icon: any }> = {
  consignatarias: { name: "Consignatárias", href: "/cliente/consignatarias", icon: Building2 },
  funcionarios: { name: "Funcionários", href: "/cliente/funcionarios", icon: Users },
  convenios: { name: "Convênios", href: "/cliente/locais", icon: Store },
}

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session } = useSession()

  // Filtrar navegação baseado nas permissões do usuário
  const userPermissions = (session?.user as any)?.permissions || []
  const userModules = getUserModules(userPermissions)
  
  // Dashboard sempre visível + módulos com permissão
  const navigation = [
    dashboardNav,
    ...userModules.map(module => moduleRoutes[module.id]).filter(Boolean)
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 consignado:from-blue-50 consignado:to-slate-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-white/95 backdrop-blur-sm dark:bg-gray-950/95 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ConsigExpress
                </h1>
                <span className="text-xs text-muted-foreground">Portal do Cliente</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link key={item.name} href={item.href} onClick={() => setSidebarOpen(false)}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 transition-all",
                      isActive && "bg-gradient-to-r from-green-500/10 to-blue-500/10 text-green-600 dark:text-green-400 border-l-4 border-green-500"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{item.name}</span>
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-3">
                  <Avatar className="h-10 w-10 border-2 border-green-500">
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-600 text-white font-semibold">
                      CL
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-semibold">Cliente</span>
                    <span className="text-xs text-muted-foreground">cliente@example.com</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 flex items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {session?.user?.name || "Cliente"}
            </h2>
          </div>
          
          <ThemeSwitcher />
        </header>

        {/* Page content */}
        <main className="p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

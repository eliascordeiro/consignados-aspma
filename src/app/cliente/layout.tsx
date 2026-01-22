"use client"

import { useState, useEffect } from "react"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  LayoutDashboard, 
  Building2,
  Users,
  Store,
  LogOut,
  Menu,
  X,
  CreditCard,
  UserCog,
  FileText,
  ShoppingCart
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { getUserModules } from "@/config/permissions"
import { PerfilModal } from "@/components/perfil-modal"

// Dashboard é sempre visível, outros módulos baseados em permissões
const dashboardNav = { name: "Dashboard", href: "/cliente/dashboard", icon: LayoutDashboard }
const moduleRoutes: Record<string, { name: string; href: string; icon: any }> = {
  consignatarias: { name: "Consignatárias", href: "/cliente/consignatarias", icon: Building2 },
  funcionarios: { name: "Funcionários", href: "/cliente/funcionarios", icon: Users },
  convenios: { name: "Convênios", href: "/cliente/locais", icon: Store },
  vendas: { name: "Vendas", href: "/cliente/vendas", icon: ShoppingCart },
  usuarios: { name: "Usuários", href: "/cliente/usuarios", icon: UserCog },
  logs: { name: "Logs de Auditoria", href: "/cliente/logs", icon: FileText },
}

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [perfilModalOpen, setPerfilModalOpen] = useState(false)
  const [managerName, setManagerName] = useState<string | null>(null)
  const { data: session } = useSession()

  // Buscar nome do MANAGER se for usuário subordinado
  useEffect(() => {
    if (session?.user?.role === "USER") {
      fetch("/api/cliente/manager-info")
        .then(res => res.json())
        .then(data => {
          if (data.managerName) {
            setManagerName(data.managerName)
          }
        })
        .catch(err => console.error("Erro ao buscar MANAGER:", err))
    }
  }, [session])

  // Filtrar navegação baseado nas permissões do usuário
  const userPermissions = (session?.user as any)?.permissions || []
  const userModules = getUserModules(userPermissions)
  
  // Dashboard sempre visível + módulos com permissão
  const navigation = [
    dashboardNav,
    ...userModules.map(module => moduleRoutes[module.id]).filter(Boolean)
  ]

  // Nome para exibir no header (MANAGER se for USER subordinado, senão próprio nome)
  const headerName = session?.user?.role === "USER" && managerName 
    ? managerName 
    : session?.user?.name || "Cliente"

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
            <TooltipProvider>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-3">
                    <Avatar className="h-10 w-10 border-2 border-green-500">
                      <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-600 text-white font-semibold">
                        {session?.user?.name
                          ?.split(' ')
                          .map(n => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase() || 'CL'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-sm overflow-hidden flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-semibold truncate w-full text-left">
                            {session?.user?.name || 'Cliente'}
                          </span>
                        </TooltipTrigger>
                        {session?.user?.name && session.user.name.length > 20 && (
                          <TooltipContent side="top" align="start">
                            <p>{session.user.name}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground truncate w-full text-left">
                            {session?.user?.email || 'cliente@example.com'}
                          </span>
                        </TooltipTrigger>
                        {session?.user?.email && session.user.email.length > 25 && (
                          <TooltipContent side="top" align="start">
                            <p>{session.user.email}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPerfilModalOpen(true)}>
                    <UserCog className="mr-2 h-4 w-4" />
                    Editar Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 md:gap-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm px-4 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 flex items-center min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h2 className="text-sm md:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {headerName}
                  </h2>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start">
                  <p>{headerName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <ThemeSwitcher />
        </header>

        {/* Page content */}
        <main className="p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* Modal de Perfil */}
      <PerfilModal open={perfilModalOpen} onOpenChange={setPerfilModalOpen} />
    </div>
  )
}

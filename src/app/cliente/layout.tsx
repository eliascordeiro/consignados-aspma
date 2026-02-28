"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import ChatWidget from "@/components/chat-widget"
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
  Users,
  LogOut,
  Menu,
  X,
  CreditCard,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { getUserModules, PERMISSION_MODULES } from "@/config/permissions"
import { PerfilModal } from "@/components/perfil-modal"

// Dashboard é sempre visível para todos
const dashboardNav = { name: "Dashboard", href: "/cliente/dashboard", icon: LayoutDashboard }

// Rotas dos módulos geradas AUTOMATICAMENTE a partir de permissions.ts (fonte única de verdade)
// A ordem no sidebar segue EXATAMENTE a ordem definida em PERMISSION_MODULES
const moduleRoutes: Record<string, { name: string; href: string; icon: any }> = Object.fromEntries(
  PERMISSION_MODULES.map(m => [m.id, { name: m.displayName, href: m.href, icon: m.icon }])
)

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [perfilModalOpen, setPerfilModalOpen] = useState(false)
  const [managerName, setManagerName] = useState<string | null>(null)
  const { data: session } = useSession()

  // Detectar desktop para aplicar padding inline
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Restaurar estado colapsado do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  // Verificar se é conveniado - redirecionar para portal correto
  useEffect(() => {
    fetch("/api/convenio/check")
      .then(res => res.json())
      .then(data => {
        if (data?.isConvenio) {
          window.location.href = "/convenio/dashboard"
        }
      })
      .catch(() => {})
  }, [])

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
  
  // Montar navegação: Dashboard (sempre) + módulos na ordem de PERMISSION_MODULES (por permissão)
  const moduleNavItems = userModules.map(module => moduleRoutes[module.id]).filter(Boolean)
  
  const navigation = [
    dashboardNav,
    ...moduleNavItems
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
          "fixed inset-y-0 left-0 z-50 transform bg-sidebar/95 backdrop-blur-sm border-r border-border transition-all duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: isDesktop ? (collapsed ? 72 : 256) : 256 }}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <div className={cn("flex items-center gap-2 overflow-hidden", collapsed && "lg:justify-center")}>
              <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <div className={cn("transition-all duration-300 overflow-hidden", collapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100")}>
                <h1 className="text-lg font-bold text-foreground whitespace-nowrap">
                  A.S.P.M.A
                </h1>
                <span className="text-xs text-muted-foreground whitespace-nowrap">Portal do Cliente</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Navigation */}
          <TooltipProvider delayDuration={0}>
            <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/cliente/dashboard' && pathname.startsWith(item.href))
                
                const linkContent = (
                  <Link key={item.name} href={item.href} onClick={() => setSidebarOpen(false)}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full transition-all duration-200 group",
                        collapsed ? "lg:justify-center lg:px-2" : "justify-start gap-3",
                        isActive && "bg-gradient-to-r from-green-500/10 to-blue-500/10 text-green-600 dark:text-green-400 border-l-4 border-green-500",
                        !isActive && "hover:bg-gray-100 dark:hover:bg-gray-800/60"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-green-600 dark:text-green-400")} />
                      <span className={cn(
                        "font-medium whitespace-nowrap transition-all duration-300 overflow-hidden",
                        collapsed ? "lg:w-0 lg:opacity-0 lg:hidden" : "w-auto opacity-100"
                      )}>
                        {item.name}
                      </span>
                    </Button>
                  </Link>
                )

                // No modo colapsado no desktop, mostrar tooltip
                if (collapsed) {
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="hidden lg:block font-medium">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return <div key={item.name}>{linkContent}</div>
              })}
            </nav>
          </TooltipProvider>

          {/* Collapse toggle button - desktop only */}
          <div className="hidden lg:flex justify-center border-t border-border py-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleCollapsed}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? "Expandir menu" : "Recolher menu"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* User menu */}
          <div className="border-t border-border p-3">
            <TooltipProvider delayDuration={0}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" className="w-full justify-center h-auto p-2 lg:p-2">
                          <Avatar className="h-9 w-9 border-2 border-green-500 shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-600 text-white font-semibold text-xs">
                              {session?.user?.name
                                ?.split(' ')
                                .map(n => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase() || 'CL'}
                            </AvatarFallback>
                          </Avatar>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="hidden lg:block">
                        <p className="font-medium">{session?.user?.name || 'Cliente'}</p>
                        <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-3">
                      <Avatar className="h-10 w-10 border-2 border-green-500 shrink-0">
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
                  )}
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
      <div className="transition-all duration-300" style={{ paddingLeft: isDesktop ? (collapsed ? 72 : 256) : 0 }}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 md:gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6">
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
                  <h2 className="text-sm md:text-lg font-semibold text-foreground truncate">
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

      {/* Chat IA Widget */}
      <ChatWidget apiEndpoint="/api/cliente/chat" />
    </div>
  )
}

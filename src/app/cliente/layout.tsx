"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  AlertTriangle,
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
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [perfilModalOpen, setPerfilModalOpen] = useState(false)
  const [managerName, setManagerName] = useState<string | null>(null)
  const [passwordDaysLeft, setPasswordDaysLeft] = useState<number | null>(null)
  const [idleWarning, setIdleWarning] = useState(false)
  const [idleCountdown, setIdleCountdown] = useState(30)
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

  // Verificar renovação obrigatória de senha (mensal)
  useEffect(() => {
    if (!session) return
    const user = session.user as any
    if (user?.isConvenio) return
    if (pathname.startsWith('/cliente/alterar-senha')) return
    const changedAt = user?.passwordChangedAt ? new Date(user.passwordChangedAt) : null
    if (!changedAt) {
      router.push('/cliente/alterar-senha')
      return
    }
    const daysElapsed = (Date.now() - changedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysElapsed >= 30) {
      router.push('/cliente/alterar-senha')
      return
    }
    const daysLeft = Math.ceil(30 - daysElapsed)
    if (daysLeft <= 5) setPasswordDaysLeft(daysLeft)
    else setPasswordDaysLeft(null)
  }, [session, pathname, router])

  // Timeout por inatividade: aviso em 4:30, logout em 5:00
  useEffect(() => {
    if (!session) return
    const IDLE_TIMEOUT = 5 * 60 * 1000      // 5 minutos
    const WARN_BEFORE  = 30 * 1000          // aviso 30s antes
    let warningTimer: ReturnType<typeof setTimeout>
    let logoutTimer:  ReturnType<typeof setTimeout>
    let countdownInterval: ReturnType<typeof setInterval>

    const reset = () => {
      setIdleWarning(false)
      setIdleCountdown(30)
      clearTimeout(warningTimer)
      clearTimeout(logoutTimer)
      clearInterval(countdownInterval)

      warningTimer = setTimeout(() => {
        setIdleWarning(true)
        let secs = 30
        setIdleCountdown(secs)
        countdownInterval = setInterval(() => {
          secs -= 1
          setIdleCountdown(secs)
        }, 1000)
        logoutTimer = setTimeout(() => {
          clearInterval(countdownInterval)
          signOut({ callbackUrl: '/login' })
        }, WARN_BEFORE)
      }, IDLE_TIMEOUT - WARN_BEFORE)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(warningTimer)
      clearTimeout(logoutTimer)
      clearInterval(countdownInterval)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [session])

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
  const userRole = (session?.user as any)?.role
  const userModules = getUserModules(userPermissions)
  
  // Montar navegação: Dashboard (sempre) + módulos na ordem de PERMISSION_MODULES (por permissão)
  // MANAGER não vê o módulo de Usuários e Permissões na sidebar
  const moduleNavItems = userModules
    .filter(module => !(module.id === 'usuarios' && userRole === 'USER'))
    .map(module => moduleRoutes[module.id]).filter(Boolean)
  
  const navigation = [
    dashboardNav,
    ...moduleNavItems
  ]

  // Nome para exibir no header (MANAGER se for USER subordinado, senão próprio nome)
  const headerName = session?.user?.role === "USER" && managerName 
    ? managerName 
    : session?.user?.name || "Cliente"

  return (
    <div className="min-h-screen bg-background">
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
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <div className={cn("flex items-center gap-2 overflow-hidden", collapsed && "lg:justify-center")}>
              <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <div className={cn("transition-all duration-300 overflow-hidden", collapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100")}>
                <h1 className="text-lg font-bold text-sidebar-foreground whitespace-nowrap">
                  A.S.P.M.A
                </h1>
                <span className="text-xs text-sidebar-foreground/60 whitespace-nowrap">Portal do Administrador</span>
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
                      variant="ghost"
                      className={cn(
                        "w-full transition-all duration-200 group text-sidebar-foreground/80 hover:text-sidebar-foreground",
                        collapsed ? "lg:justify-center lg:px-2" : "justify-start gap-3",
                        isActive && "bg-sidebar-primary/15 text-sidebar-foreground border-l-4 border-sidebar-primary",
                        !isActive && "hover:bg-sidebar-accent"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0 text-sidebar-foreground/60", isActive && "text-sidebar-primary")} />
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
          <div className="hidden lg:flex justify-center border-t border-sidebar-border py-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleCollapsed}
                    className="h-8 w-8 p-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
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
          <div className="border-t border-sidebar-border p-3">
            <TooltipProvider delayDuration={0}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                    <Button variant="ghost" className="w-full justify-center h-auto p-2 lg:p-2 hover:bg-sidebar-accent">
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
                    <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
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
                            <span className="font-semibold truncate w-full text-left text-sidebar-foreground">
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
                            <span className="text-xs text-sidebar-foreground/60 truncate w-full text-left">
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

        {/* Aviso de expiração de senha */}
        {passwordDaysLeft !== null && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 md:px-6 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {passwordDaysLeft <= 1
                  ? 'Sua senha expira amanhã! Renove agora para não perder o acesso.'
                  : `Sua senha expira em ${passwordDaysLeft} dia${passwordDaysLeft > 1 ? 's' : ''}. Renove antes de ser bloqueado.`}
              </span>
            </div>
            <Link href="/cliente/alterar-senha" className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0">
              Renovar agora
            </Link>
          </div>
        )}

        {/* Page content */}
        <main className="p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* Modal de Perfil */}
      <PerfilModal open={perfilModalOpen} onOpenChange={setPerfilModalOpen} />

      {/* Aviso de inatividade */}
      {idleWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-foreground mb-2">Sessão expirando</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Sua sessão será encerrada por inatividade em{' '}
              <span className="font-bold text-red-500">{idleCountdown}s</span>.
            </p>
            <button
              onClick={() => setIdleWarning(false)}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2 px-4 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Continuar sessão
            </button>
          </div>
        </div>
      )}

      {/* Chat IA Widget */}
      <ChatWidget apiEndpoint="/api/cliente/chat" />
    </div>
  )
}

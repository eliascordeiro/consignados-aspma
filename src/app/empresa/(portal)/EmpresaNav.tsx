'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  Users,
  BarChart3,
  KeyRound,
  UserPlus,
  List,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const navItems = [
  { label: 'Dashboard', href: '/empresa/dashboard', icon: Home },
  {
    label: 'Funcionários',
    href: '/empresa/funcionarios',
    icon: Users,
    subItems: [
      { label: 'Listar Todos', href: '/empresa/funcionarios', icon: List },
      { label: 'Cadastrar Novo', href: '/empresa/funcionarios/novo', icon: UserPlus },
    ],
  },
  { label: 'Relatórios', href: '/empresa/relatorios', icon: BarChart3 },
  { label: 'Alterar Senha', href: '/empresa/alterar-senha', icon: KeyRound },
]

export default function EmpresaNav() {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setOpenMenu(null)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/empresa/dashboard') return pathname === '/empresa/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <nav className="bg-card border-b border-border" ref={menuRef}>
      <div className="container mx-auto px-4">
        {/* Mobile hamburger */}
        <div className="flex items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-foreground/70 hover:bg-accent transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            Menu
          </button>
        </div>

        {/* Desktop */}
        <div className="hidden md:flex gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            if (item.subItems) {
              return (
                <div key={item.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                    className={
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ' +
                      (active
                        ? 'text-violet-700 dark:text-violet-300 border-b-2 border-violet-500 bg-violet-500/10'
                        : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground')
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <ChevronDown
                      className={
                        'h-3 w-3 transition-transform ' +
                        (openMenu === item.label ? 'rotate-180' : '')
                      }
                    />
                  </button>

                  {openMenu === item.label && (
                    <div className="absolute top-full left-0 z-50 mt-0 w-52 rounded-b-lg border border-t-0 border-border bg-card shadow-lg">
                      {item.subItems.map((sub) => {
                        const SubIcon = sub.icon
                        const subActive = pathname === sub.href
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={() => setOpenMenu(null)}
                            className={
                              'flex items-center gap-2 px-4 py-3 text-sm transition-colors last:rounded-b-lg ' +
                              (subActive
                                ? 'text-violet-700 dark:text-violet-300 bg-violet-500/10 font-medium'
                                : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground')
                            }
                          >
                            <SubIcon className="h-4 w-4" />
                            {sub.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ' +
                  (active
                    ? 'text-violet-700 dark:text-violet-300 border-b-2 border-violet-500 bg-violet-500/10'
                    : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground')
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)

              if (item.subItems) {
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                      className={
                        'flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors ' +
                        (active
                          ? 'text-violet-700 dark:text-violet-300 bg-violet-500/10'
                          : 'text-foreground/70 hover:bg-accent')
                      }
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                      <ChevronDown
                        className={
                          'h-3 w-3 ml-auto transition-transform ' +
                          (openMenu === item.label ? 'rotate-180' : '')
                        }
                      />
                    </button>

                    {openMenu === item.label && (
                      <div className="bg-muted">
                        {item.subItems.map((sub) => {
                          const SubIcon = sub.icon
                          const subActive = pathname === sub.href
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={
                                'flex items-center gap-3 pl-12 pr-4 py-3 text-sm transition-colors ' +
                                (subActive
                                  ? 'text-violet-700 dark:text-violet-300 bg-violet-500/10 font-medium'
                                  : 'text-muted-foreground hover:bg-accent')
                              }
                            >
                              <SubIcon className="h-4 w-4" />
                              {sub.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ' +
                    (active
                      ? 'text-violet-700 dark:text-violet-300 bg-violet-500/10'
                      : 'text-foreground/70 hover:bg-accent')
                  }
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}

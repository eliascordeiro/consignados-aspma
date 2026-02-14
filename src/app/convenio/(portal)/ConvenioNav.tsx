'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, ShoppingCart, BarChart3, Plus, List, ChevronDown, Menu, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const navItems = [
  {
    label: 'Dashboard',
    href: '/convenio/dashboard',
    icon: Home,
  },
  {
    label: 'Vendas',
    href: '/convenio/vendas',
    icon: ShoppingCart,
    subItems: [
      { label: 'Nova Venda', href: '/convenio/vendas/nova', icon: Plus },
      { label: 'Tabela de Vendas', href: '/convenio/vendas', icon: List },
    ],
  },
  {
    label: 'Relatórios',
    href: '/convenio/relatorios',
    icon: BarChart3,
  },
]

export default function ConvenioNav() {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
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

  // Fecha menu mobile ao navegar
  useEffect(() => {
    setMobileOpen(false)
    setOpenMenu(null)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/convenio/dashboard') {
      return pathname === '/convenio/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="bg-card border-b border-border" ref={menuRef}>
      <div className="container mx-auto px-4">
        {/* Botão hamburger mobile */}
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

        {/* Menu Desktop (horizontal) */}
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
                        ? 'text-primary border-b-2 border-primary bg-primary/10'
                        : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground')
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <ChevronDown className={'h-3 w-3 transition-transform ' + (openMenu === item.label ? 'rotate-180' : '')} />
                  </button>

                  {openMenu === item.label && (
                    <div className="absolute top-full left-0 z-50 mt-0 w-48 rounded-b-lg border border-t-0 border-border bg-card shadow-lg">
                      {item.subItems.map((sub) => {
                        const SubIcon = sub.icon
                        const subActive = pathname === sub.href

                        return (
                          <Link
                            key={sub.href + sub.label}
                            href={sub.href}
                            onClick={() => setOpenMenu(null)}
                            className={
                              'flex items-center gap-2 px-4 py-3 text-sm transition-colors first:rounded-t-none last:rounded-b-lg ' +
                              (subActive
                                ? 'text-primary bg-primary/10 font-medium'
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
                    ? 'text-primary border-b-2 border-primary bg-primary/10'
                    : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground')
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Menu Mobile (vertical) */}
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
                          ? 'text-primary bg-primary/10'
                          : 'text-foreground/70 hover:bg-accent')
                      }
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                      <ChevronDown className={'h-3 w-3 ml-auto transition-transform ' + (openMenu === item.label ? 'rotate-180' : '')} />
                    </button>

                    {openMenu === item.label && (
                      <div className="bg-muted">
                        {item.subItems.map((sub) => {
                          const SubIcon = sub.icon
                          const subActive = pathname === sub.href

                          return (
                            <Link
                              key={sub.href + sub.label}
                              href={sub.href}
                              className={
                                'flex items-center gap-3 pl-12 pr-4 py-3 text-sm transition-colors ' +
                                (subActive
                                  ? 'text-primary bg-primary/10 font-medium'
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
                      ? 'text-primary bg-primary/10'
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

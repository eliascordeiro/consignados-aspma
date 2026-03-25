'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ChatWidget from '@/components/chat-widget'

const navItems = [
  {
    href: '/portal/dashboard',
    label: 'Início',
    icon: (active: boolean, sidebar?: boolean) => (
      <svg className={`w-6 h-6 ${sidebar ? (active ? 'text-white' : 'text-emerald-200') : (active ? 'text-emerald-600' : 'text-gray-400')}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d={active
            ? 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
            : 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
          }
        />
      </svg>
    ),
  },
  {
    href: '/portal/desconto',
    label: 'Descontos',
    icon: (active: boolean, sidebar?: boolean) => (
      <svg className={`w-6 h-6 ${sidebar ? (active ? 'text-white' : 'text-emerald-200') : (active ? 'text-emerald-600' : 'text-gray-400')}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d={active
            ? 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
            : 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
          }
        />
      </svg>
    ),
  },
  {
    href: '/portal/compras',
    label: 'Compras',
    icon: (active: boolean, sidebar?: boolean) => (
      <svg className={`w-6 h-6 ${sidebar ? (active ? 'text-white' : 'text-emerald-200') : (active ? 'text-emerald-600' : 'text-gray-400')}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d={active
            ? 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
            : 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
          }
        />
      </svg>
    ),
  },
  {
    href: '/portal/perfil',
    label: 'Meus Dados',
    icon: (active: boolean, sidebar?: boolean) => (
      <svg className={`w-6 h-6 ${sidebar ? (active ? 'text-white' : 'text-emerald-200') : (active ? 'text-emerald-600' : 'text-gray-400')}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2}
          d={active
            ? 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            : 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z'
          }
        />
      </svg>
    ),
  },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [dark, setDark] = useState(false)

  // Carrega preferência salva (ou sistema)
  useEffect(() => {
    const saved = localStorage.getItem('portal-theme')
    if (saved) {
      setDark(saved === 'dark')
    } else {
      setDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    localStorage.setItem('portal-theme', next ? 'dark' : 'light')
  }

  async function handleLogout() {
    await fetch('/api/portal/auth', { method: 'DELETE' })
    router.push('/portal/login')
    router.refresh()
  }

  if (pathname === '/portal/login' || pathname?.startsWith('/portal/primeiro-acesso') || pathname?.startsWith('/portal/redefinir-senha')) {
    return <>{children}</>
  }

  // Ícone lua (modo escuro) / sol (modo claro)
  const ThemeIcon = () => dark ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  )

  return (
    <div className={`min-h-screen bg-gray-50 pdark:bg-gray-900 flex flex-col lg:flex-row transition-colors duration-200${dark ? ' pdark' : ''}`}>

      {/* ── SIDEBAR — visível apenas em desktop (lg+) ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-emerald-600 text-white sticky top-0 h-screen overflow-y-auto shadow-xl">
        {/* Logo / marca */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-emerald-500/50">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs text-emerald-200 leading-none">Portal do Sócio</p>
            <p className="text-base font-bold leading-tight">ASPMA</p>
          </div>
        </div>

        {/* Itens de navegação */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon(active, true)}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Botão sair */}
        <div className="px-3 py-4 border-t border-emerald-500/50 space-y-1">
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-emerald-100 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ThemeIcon />
            {dark ? 'Modo claro' : 'Modo escuro'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-emerald-100 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* ── COLUNA PRINCIPAL ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header — visível apenas em mobile */}
        <header className="lg:hidden sticky top-0 z-40 bg-emerald-600 text-white shadow-md">
          <div className="pt-safe-top" />
          <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs text-emerald-200 leading-none">Portal do Sócio</p>
                <p className="text-sm font-semibold leading-tight">ASPMA</p>
              </div>
            </div>
            <button
              onClick={toggleDark}
              className="flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-xl w-8 h-8 transition-colors active:scale-95"
            >
              <ThemeIcon />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sair
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8 pdark:bg-gray-900">
          <div className="max-w-lg mx-auto lg:max-w-2xl lg:mx-0 lg:px-4 lg:py-4">
            {children}
          </div>
        </main>

        {/* Bottom Navigation — visível apenas em mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white pdark:bg-gray-800 border-t border-gray-200 pdark:border-gray-700 pb-safe-bottom shadow-lg z-50">
          <div className="max-w-lg mx-auto flex">
            {navItems.map(item => {
              const active = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors active:scale-95 ${
                    active ? 'text-emerald-500' : 'text-gray-500 pdark:text-gray-400'
                  }`}
                >
                  {item.icon(active)}
                  <span className={`text-[10px] font-medium whitespace-nowrap ${active ? 'text-emerald-500' : 'text-gray-400 pdark:text-gray-500'}`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>

      </div>
      <ChatWidget apiEndpoint="/api/portal/chat" />
    </div>
  )
}

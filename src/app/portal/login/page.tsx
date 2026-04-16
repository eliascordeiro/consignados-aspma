'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatarCelular } from '@/lib/utils'
import Link from 'next/link'

export default function PortalLoginPage() {
  const router = useRouter()
  const [celular, setCelular] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const params = new URLSearchParams(window.location.search)
    if (params.get('senha') === 'criada') setSucesso('Senha criada com sucesso! Faça login.')
    if (params.get('created') === '1') setSucesso('Senha criada! Faça login.')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: celular.trim(), senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.semSenha) {
          router.push('/portal/redefinir-senha')
          return
        }
        setErro(data.error || 'Erro ao entrar')
        return
      }

      // Navegação completa para forçar re-render do server layout (carregar logo)
      window.location.href = '/portal/dashboard'
      return
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Logo da Associação */}
        <div className="mb-8 text-center animate-in fade-in slide-in-from-top duration-500">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Portal do Sócio</h1>
        </div>

        {/* Card de Login */}
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20 animate-in fade-in slide-in-from-bottom duration-700">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo!</h2>
            <p className="text-gray-600 text-sm">Informe seu celular e senha para acessar</p>
          </div>

          {sucesso && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5 text-emerald-800 text-sm mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-500">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{sucesso}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Celular */}
            <div className="space-y-2">
              <label htmlFor="celular" className="block text-sm font-semibold text-gray-700">
                Celular
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="celular"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={15}
                  value={celular}
                  onChange={e => setCelular(formatarCelular(e.target.value))}
                  placeholder="(41) 99999-9999"
                  required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white
                             text-base transition-all duration-200 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <label htmlFor="senha" className="block text-sm font-semibold text-gray-700">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white
                             text-base transition-all duration-200 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 text-red-800 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{erro}</span>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold text-base
                         hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] transition-all duration-200
                         shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>Entrar</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              )}
            </button>
          </form>

          {/* Primeiro acesso */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-center text-gray-600">
              Primeiro acesso?{' '}
              <a href="/portal/redefinir-senha" className="text-emerald-600 font-semibold hover:text-emerald-700 hover:underline transition-colors">
                Criar / redefinir senha
              </a>
            </p>
          </div>
        </div>

        {/* Footer com links legais */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-emerald-100">
            <Link href="/politica-privacidade" className="hover:text-white hover:underline transition-colors">
              Privacidade
            </Link>
            <span className="text-emerald-300">•</span>
            <Link href="/termos-uso" className="hover:text-white hover:underline transition-colors">
              Termos de Uso
            </Link>
            <span className="text-emerald-300">•</span>
            <Link href="/politica-cookies" className="hover:text-white hover:underline transition-colors">
              Cookies
            </Link>
          </div>
          
          <p className="text-emerald-100 text-xs text-center font-medium">
            © {new Date().getFullYear()} ASPMA · Associação dos Servidores Públicos de Araucária
          </p>
        </div>
      </div>
    </div>
  )
}

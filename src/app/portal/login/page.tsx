'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

function formatarIdentificador(valor: string) {
  // Remove tudo que não seja letra, número ou @/.
  const soNumeros = valor.replace(/\D/g, '')

  // Se parecer com CPF (11 dígitos) — aplica máscara
  if (/^\d{11}$/.test(soNumeros)) {
    return soNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return valor
}

export default function PortalLoginPage() {
  const router = useRouter()
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim(), senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.semSenha) {
          router.push('/portal/primeiro-acesso')
          return
        }
        setErro(data.error || 'Erro ao entrar')
        return
      }

      router.push('/portal/dashboard')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex flex-col items-center justify-center px-5 py-10">
      {/* Logo da Associação */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-3 bg-white rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wide">Portal do Sócio</h1>
        <p className="text-emerald-100 text-sm mt-1">ASPMA</p>
      </div>

      {/* Card de Login */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Bem-vindo!</h2>
        <p className="text-gray-500 text-sm mb-6">Use seu CPF, e-mail ou celular</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identificador */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPF, E-mail ou Celular
            </label>
            <input
              type="text"
              inputMode="text"
              autoComplete="username"
              value={identificador}
              onChange={e => setIdentificador(e.target.value)}
              onBlur={e => setIdentificador(formatarIdentificador(e.target.value))}
              placeholder="Ex: 123.456.789-00"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent
                         text-base transition"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Sua senha"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent
                           text-base pr-12 transition"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                tabIndex={-1}
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
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
              {erro}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-base
                       active:scale-95 transition-all shadow-md hover:bg-emerald-700
                       disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>
        </form>

        {/* Primeiro acesso */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Primeiro acesso?{' '}
            <a href="/portal/primeiro-acesso" className="text-emerald-600 font-semibold hover:underline">
              Criar senha
            </a>
          </p>
        </div>
      </div>

      <p className="mt-8 text-emerald-200 text-xs text-center">
        © {new Date().getFullYear()} ASPMA · Associação dos Servidores
      </p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PrimeiroAcessoPage() {
  const router = useRouter()
  const [passo, setPasso] = useState<'identificar' | 'criar'>('identificar')
  const [identificador, setIdentificador] = useState('')
  const [cpf, setCpf] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Passo 1: verificar se o sócio existe
  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/primeiro-acesso/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Não encontrado')
        return
      }

      setPasso('criar')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  // Passo 2: criar senha
  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/portal/primeiro-acesso/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim(), senha: novaSenha }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao criar senha')
        return
      }

      router.push('/portal/login?created=1')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex flex-col items-center justify-center px-5 py-10">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-9 h-9 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Primeiro Acesso</h1>
        <p className="text-emerald-100 text-sm mt-1">Portal do Sócio · ASPMA</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        {passo === 'identificar' ? (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Identificar-se</h2>
            <p className="text-gray-500 text-sm mb-5">Informe seu CPF, e-mail ou celular cadastrado</p>

            <form onSubmit={handleVerificar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF, E-mail ou Celular</label>
                <input
                  type="text"
                  value={identificador}
                  onChange={e => setIdentificador(e.target.value)}
                  placeholder="Ex: 123.456.789-00"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-base transition"
                />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-base
                           active:scale-95 transition-all shadow-md hover:bg-emerald-700 disabled:opacity-70"
              >
                {loading ? 'Verificando...' : 'Continuar'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Criar sua senha</h2>
            <p className="text-gray-500 text-sm mb-5">Escolha uma senha segura com pelo menos 6 caracteres</p>

            <form onSubmit={handleCriar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-base transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
                <input
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-base transition"
                />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-base
                           active:scale-95 transition-all shadow-md hover:bg-emerald-700 disabled:opacity-70"
              >
                {loading ? 'Salvando...' : 'Criar senha e entrar'}
              </button>
            </form>
          </>
        )}

        <div className="mt-5 text-center">
          <a href="/portal/login" className="text-emerald-600 text-sm font-medium hover:underline">
            ← Voltar para login
          </a>
        </div>
      </div>
    </div>
  )
}

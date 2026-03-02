'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Passo = 'identificar' | 'codigo' | 'senha'

interface Canais {
  celularMask: string | null
}

// Componente de entrada OTP com 6 caixas individuais
function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function handleChange(idx: number, char: string) {
    const digit = char.replace(/\D/g, '').slice(-1)
    const arr = value.padEnd(6, ' ').split('')
    arr[idx] = digit || ' '
    const next = arr.join('')
    onChange(next.replace(/ /g, ''))

    if (digit && idx < 5) {
      inputs.current[idx + 1]?.focus()
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (!value[idx] && idx > 0) {
        inputs.current[idx - 1]?.focus()
        const arr = value.padEnd(6, ' ').split('')
        arr[idx - 1] = ' '
        onChange(arr.join('').replace(/ /g, ''))
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    inputs.current[Math.min(pasted.length, 5)]?.focus()
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className="w-11 h-12 text-center text-xl font-bold rounded-xl border-2
                     border-gray-200 bg-gray-50 text-gray-900
                     focus:border-emerald-500 focus:outline-none focus:bg-white
                     transition-colors"
        />
      ))}
    </div>
  )
}

// Indicador de passo
function StepIndicator({ atual }: { atual: number }) {
  const passos = ['Identificar', 'Código', 'Senha']
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {passos.map((nome, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            i < atual ? 'bg-emerald-500 text-white' :
            i === atual ? 'bg-emerald-600 text-white ring-2 ring-emerald-200' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i < atual ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : i + 1}
          </div>
          {i < passos.length - 1 && (
            <div className={`w-6 h-0.5 ${i < atual ? 'bg-emerald-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [passo, setPasso] = useState<Passo>('identificar')
  const [celular, setCelular] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [confirmedToken, setConfirmedToken] = useState('')
  const [canais, setCanais] = useState<Canais | null>(null)
  const [otp, setOtp] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [reenvioTimer, setReenvioTimer] = useState(0)

  function iniciarTimer() {
    setReenvioTimer(60)
    const iv = setInterval(() => {
      setReenvioTimer(t => {
        if (t <= 1) { clearInterval(iv); return 0 }
        return t - 1
      })
    }, 1000)
  }

  // ── Passo 1: Solicitar OTP ───────────────────────────────────────────────
  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/redefinir-senha/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: celular.trim() }),
      })
      const data = await res.json()

      if (!res.ok) { setErro(data.error || 'Erro ao solicitar'); return }

      setSessionToken(data.sessionToken)
      setCanais({ celularMask: data.celularMask })
      setPasso('codigo')
      iniciarTimer()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReenviar() {
    setErro('')
    setOtp('')
    setLoading(true)
    try {
      const res = await fetch('/api/portal/redefinir-senha/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ celular: celular.trim() }),
      })
      const data = await res.json()
      if (res.ok) { setSessionToken(data.sessionToken); setCanais({ celularMask: data.celularMask }); iniciarTimer() }
      else setErro(data.error || 'Erro ao reenviar')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  // ── Passo 2: Verificar OTP ───────────────────────────────────────────────
  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length < 6) { setErro('Digite os 6 dígitos do código'); return }
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/redefinir-senha/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, codigo: otp }),
      })
      const data = await res.json()

      if (!res.ok) { setErro(data.error || 'Código inválido'); return }

      setConfirmedToken(data.confirmedToken)
      setPasso('senha')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  // ── Passo 3: Salvar senha ────────────────────────────────────────────────
  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (novaSenha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres'); return }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem'); return }
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/portal/redefinir-senha/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedToken, senha: novaSenha }),
      })
      const data = await res.json()

      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }

      router.push('/portal/login?senha=criada')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const passoNum = passo === 'identificar' ? 0 : passo === 'codigo' ? 1 : 2

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex flex-col items-center justify-center px-5 py-10">
      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-9 h-9 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Criar / Redefinir Senha</h1>
        <p className="text-emerald-100 text-sm mt-0.5">Portal do Sócio · ASPMA</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <StepIndicator atual={passoNum} />

        {/* ── PASSO 1 ── */}
        {passo === 'identificar' && (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Celular cadastrado</h2>
            <p className="text-gray-500 text-sm mb-5">Informe o celular cadastrado na ASPMA. Enviaremos um código de verificação via WhatsApp.</p>

            <form onSubmit={handleSolicitar} className="space-y-4">
              <input
                type="tel"
                inputMode="numeric"
                value={celular}
                onChange={e => setCelular(e.target.value)}
                placeholder="Ex: (41) 99999-9999"
                required autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base
                           focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              />

              {erro && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}

              <button
                type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-base
                           active:scale-95 transition-all shadow-md hover:bg-emerald-700 disabled:opacity-70"
              >
                {loading ? 'Enviando código...' : 'Enviar código de verificação'}
              </button>
            </form>
          </>
        )}

        {/* ── PASSO 2 ── */}
        {passo === 'codigo' && (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Código de verificação</h2>
            {canais && (
              <p className="text-gray-500 text-sm mb-5">
                Código enviado via <span className="font-medium text-emerald-700">WhatsApp</span>
                {canais.celularMask && <> para {canais.celularMask}</>}.
              </p>
            )}

            <form onSubmit={handleVerificar} className="space-y-5">
              <OTPInput value={otp} onChange={setOtp} />

              {erro && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">{erro}</p>}

              <button
                type="submit" disabled={loading || otp.length < 6}
                className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-base
                           active:scale-95 transition-all shadow-md hover:bg-emerald-700 disabled:opacity-70"
              >
                {loading ? 'Verificando...' : 'Verificar código'}
              </button>
            </form>

            {/* Reenviar */}
            <div className="mt-4 text-center">
              {reenvioTimer > 0 ? (
                <p className="text-gray-400 text-sm">Reenviar em {reenvioTimer}s</p>
              ) : (
                <button onClick={handleReenviar} disabled={loading}
                  className="text-emerald-600 text-sm font-medium hover:underline disabled:opacity-50">
                  Não recebi o código — reenviar
                </button>
              )}
            </div>
          </>
        )}

        {/* ── PASSO 3 ── */}
        {passo === 'senha' && (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Nova senha</h2>
            <p className="text-gray-500 text-sm mb-5">Escolha uma senha com pelo menos 6 caracteres.</p>

            <form onSubmit={handleSalvar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-base pr-12
                               focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setMostrarSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
                    {mostrarSenha
                      ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  className={`w-full px-4 py-3 rounded-xl border text-gray-900 text-base bg-gray-50
                              focus:outline-none focus:ring-2 transition
                              ${confirmar && novaSenha !== confirmar
                                ? 'border-red-300 focus:ring-red-300'
                                : 'border-gray-200 focus:ring-emerald-400'}`}
                />
                {confirmar && novaSenha !== confirmar && (
                  <p className="text-red-500 text-xs mt-1">Senhas não coincidem</p>
                )}
              </div>

              {erro && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}

              <button
                type="submit" disabled={loading || novaSenha.length < 6 || novaSenha !== confirmar}
                className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-base
                           active:scale-95 transition-all shadow-md hover:bg-emerald-700 disabled:opacity-70"
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}

        <div className="mt-5 text-center">
          <a href="/portal/login" className="text-gray-400 text-sm hover:text-emerald-600 transition-colors">
            ← Voltar para o login
          </a>
        </div>
      </div>
    </div>
  )
}

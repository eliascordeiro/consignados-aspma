'use client'

import { useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { signIn } from 'next-auth/react'

export type WebAuthnStatus = 'idle' | 'loading' | 'success' | 'error' | 'unavailable'

export function useFaceLogin() {
  const [status, setStatus] = useState<WebAuthnStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Verifica se o dispositivo suporta WebAuthn / biometria de plataforma
  const isSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

  async function loginWithFace(username?: string): Promise<{ success: boolean; redirectPath?: string }> {
    if (!isSupported) {
      setStatus('unavailable')
      setError('Seu dispositivo não suporta autenticação biométrica.')
      return { success: false }
    }

    setStatus('loading')
    setError(null)

    try {
      // 1. Obter challenge do servidor
      const optRes = await fetch('/api/auth/webauthn/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username || '' }),
      })

      if (!optRes.ok) {
        const data = await optRes.json()
        throw new Error(data.error || 'Erro ao iniciar autenticação biométrica.')
      }

      const options = await optRes.json()

      // 2. Disparar o prompt biométrico no dispositivo (Face ID / Windows Hello / Android)
      const authResponse = await startAuthentication({ optionsJSON: options })

      // 3. Verificar no servidor e obter o token one-time
      const verifyRes = await fetch('/api/auth/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResponse),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        throw new Error(data.error || 'Verificação biométrica falhou.')
      }

      const { faceToken } = await verifyRes.json()

      // 4. Fazer login no NextAuth com o token one-time
      const result = await signIn('credentials', {
        faceToken,
        redirect: false,
      })

      if (result?.error) {
        throw new Error('Falha ao criar sessão após biometria.')
      }

      // 5. Determinar para onde redirecionar (mesmo fluxo do login normal)
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()

      let redirectPath = '/dashboard'
      if (session?.user?.isConvenio) {
        redirectPath = '/convenio/dashboard'
      } else if (session?.user?.role === 'ADMIN') {
        redirectPath = '/dashboard'
      } else if (session?.user?.role === 'MANAGER' || session?.user?.role === 'USER') {
        redirectPath = '/cliente/dashboard'
      }

      setStatus('success')
      return { success: true, redirectPath }
    } catch (err: any) {
      // AbortError = usuário cancelou o prompt biométrico
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
        setStatus('idle')
        setError(null)
        return { success: false }
      }

      const message = err?.message || 'Erro na autenticação biométrica.'
      setStatus('error')
      setError(message)
      return { success: false }
    }
  }

  function reset() {
    setStatus('idle')
    setError(null)
  }

  return { loginWithFace, status, error, isSupported, reset }
}

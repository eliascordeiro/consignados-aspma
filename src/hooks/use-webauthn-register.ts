'use client'

import { useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { useSession } from 'next-auth/react'

export type RegisterStatus = 'idle' | 'loading' | 'success' | 'error'

export function useWebAuthnRegister() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<RegisterStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const isSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

  async function registerBiometrics(): Promise<boolean> {
    if (!session?.user?.id) {
      setMessage('Você precisa estar logado para registrar biometria.')
      return false
    }
    if (!isSupported) {
      setMessage('Seu dispositivo não suporta autenticação biométrica.')
      return false
    }

    setStatus('loading')
    setMessage(null)

    try {
      // 1. Obter opções de registro do servidor
      const optRes = await fetch('/api/auth/webauthn/register-options', {
        method: 'POST',
      })
      if (!optRes.ok) {
        const data = await optRes.json()
        throw new Error(data.error || 'Erro ao iniciar registro.')
      }
      const options = await optRes.json()

      // 2. Disparar o prompt biométrico no dispositivo
      const registrationResponse = await startRegistration({ optionsJSON: options })

      // 3. Verificar e salvar no servidor
      const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationResponse),
      })
      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        throw new Error(data.error || 'Falha ao verificar biometria.')
      }

      const data = await verifyRes.json()
      setStatus('success')
      setMessage(data.message || 'Biometria registrada com sucesso!')
      return true
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
        setStatus('idle')
        setMessage(null)
        return false
      }
      setStatus('error')
      setMessage(err?.message || 'Erro ao registrar biometria.')
      return false
    }
  }

  function reset() {
    setStatus('idle')
    setMessage(null)
  }

  return { registerBiometrics, status, message, isSupported, reset }
}

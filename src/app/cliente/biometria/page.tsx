'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useWebAuthnRegister } from '@/hooks/use-webauthn-register'
import { Fingerprint, Trash2, Plus, ShieldCheck, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Authenticator = {
  id: string
  credentialID: string
  credentialDeviceType: string
  credentialBackedUp: boolean
  transports: string[]
  createdAt: string
}

export default function ClienteBiometriaPage() {
  const { data: session } = useSession()
  const { registerBiometrics, status, message, isSupported, reset } = useWebAuthnRegister()
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchAuthenticators() {
    setLoadingList(true)
    try {
      const res = await fetch('/api/auth/webauthn/list')
      if (res.ok) {
        const data = await res.json()
        setAuthenticators(data.authenticators || [])
      }
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    fetchAuthenticators()
  }, [])

  async function handleRegister() {
    const ok = await registerBiometrics()
    if (ok) await fetchAuthenticators()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/auth/webauthn/delete/${id}`, { method: 'DELETE' })
      if (res.ok) setAuthenticators((prev) => prev.filter((a) => a.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const deviceLabel = (a: Authenticator) => {
    if (a.transports?.includes('internal')) return 'Biometria do dispositivo (Face ID / Digital / Windows Hello)'
    if (a.transports?.includes('hybrid')) return 'Dispositivo externo (chave de segurança)'
    return `Autenticador ${a.credentialDeviceType}`
  }

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Fingerprint className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Autenticação Biométrica</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o login por Face ID, Windows Hello ou digital
          </p>
        </div>
      </div>

      {/* Card de cadastro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Cadastrar chave de acesso
          </CardTitle>
          <CardDescription>
            Registre o rosto, digital ou PIN deste dispositivo para entrar sem senha no próximo acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Seu navegador ou dispositivo não suporta autenticação biométrica (WebAuthn).
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {message}
            </div>
          )}

          <Button
            onClick={handleRegister}
            disabled={!isSupported || status === 'loading'}
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {status === 'loading' ? 'Aguardando biometria...' : 'Cadastrar este dispositivo'}
          </Button>

          {status !== 'idle' && (
            <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
              Limpar mensagem
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dispositivos cadastrados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispositivos cadastrados</CardTitle>
          <CardDescription>
            Cada dispositivo abaixo pode ser usado para entrar sem senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : authenticators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Fingerprint className="h-10 w-10 mx-auto mb-3 opacity-20" />
              Nenhum dispositivo biométrico cadastrado ainda.
            </div>
          ) : (
            <ul className="space-y-3">
              {authenticators.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <Fingerprint className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{deviceLabel(a)}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrado em {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                        {a.credentialBackedUp && ' · Sincronizado na nuvem'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                  >
                    {deletingId === a.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Os dados biométricos nunca saem do seu dispositivo. Apenas uma chave criptográfica é armazenada nos nossos servidores.
      </p>
    </div>
  )
}

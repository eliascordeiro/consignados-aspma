'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useWebAuthnRegister } from '@/hooks/use-webauthn-register'
import { Fingerprint, CheckCircle, XCircle, Loader2, Trash2, Plus, ShieldCheck } from 'lucide-react'
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

export default function BiometriaPage() {
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
    if (ok) {
      await fetchAuthenticators()
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/auth/webauthn/delete/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAuthenticators((prev) => prev.filter((a) => a.id !== id))
      }
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

      {/* Card de suporte */}
      {!isSupported && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="flex items-center gap-3 pt-6">
            <XCircle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Seu dispositivo ou navegador não suporta WebAuthn. Use Chrome, Edge ou Safari em um dispositivo com biometria.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Informação */}
      {isSupported && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="flex items-center gap-3 pt-6">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              A biometria nunca sai do seu dispositivo. O sistema usa <strong>WebAuthn/FIDO2</strong>, o padrão
              mais seguro de autenticação — sem armazenar impressão digital ou foto facial.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de autenticadores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispositivos registrados</CardTitle>
          <CardDescription>
            Cada dispositivo cadastrado pode ser usado para acessar o sistema sem senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingList ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : authenticators.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Nenhum dispositivo biométrico cadastrado ainda.
            </p>
          ) : (
            authenticators.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <Fingerprint className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{deviceLabel(a)}</p>
                    <p className="text-xs text-muted-foreground">
                      Registrado em {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                      {a.credentialBackedUp && ' · Sincronizado na nuvem'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                  title="Remover dispositivo"
                >
                  {deletingId === a.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Feedback de registro */}
      {message && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${
          status === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-950/20 border-red-200 text-red-600 dark:text-red-400'
        }`}>
          {status === 'success'
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <XCircle className="h-4 w-4 shrink-0" />
          }
          {message}
        </div>
      )}

      {/* Botão registrar */}
      {isSupported && (
        <Button
          onClick={handleRegister}
          disabled={status === 'loading'}
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {status === 'loading'
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Aguardando biometria...</>
            : <><Plus className="h-4 w-4" /> Adicionar este dispositivo</>
          }
        </Button>
      )}
    </div>
  )
}

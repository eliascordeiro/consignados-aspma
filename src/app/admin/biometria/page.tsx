'use client'

import { useState, useEffect } from 'react'
import { useWebAuthnRegister } from '@/hooks/use-webauthn-register'
import { Fingerprint, CheckCircle, XCircle, Loader2, Trash2, Plus, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const MAX_CREDENTIALS = 5

type Authenticator = {
  id: string
  credentialID: string
  credentialDeviceType: string
  credentialBackedUp: boolean
  transports: string[]
  createdAt: string
}

export default function AdminBiometriaPage() {
  const { registerBiometrics, status, message, isSupported } = useWebAuthnRegister()
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

  useEffect(() => { fetchAuthenticators() }, [])

  async function handleRegister() {
    const ok = await registerBiometrics()
    if (ok) await fetchAuthenticators()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/auth/webauthn/delete/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchAuthenticators()
    } finally {
      setDeletingId(null)
    }
  }

  const atLimit = authenticators.length >= MAX_CREDENTIALS

  const deviceLabel = (a: Authenticator) => {
    const date = new Date(a.createdAt).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    let type = 'Autenticador'
    if (a.transports?.includes('internal')) type = 'Face ID / Digital / Windows Hello'
    else if (a.transports?.includes('hybrid')) type = 'Chave de segurança (USB/NFC)'
    return { type, date }
  }

  return (
    <div className="container max-w-2xl py-8 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Fingerprint className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Chave de Acesso (Biometria)</h1>
          <p className="text-sm text-muted-foreground">Login sem senha com Face ID, Windows Hello ou digital</p>
        </div>
      </div>

      {/* Sem suporte */}
      {!isSupported && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="flex items-center gap-3 pt-6">
            <XCircle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Seu navegador não suporta WebAuthn. Use Chrome, Edge ou Safari em um dispositivo com biometria.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Explicação */}
      {isSupported && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="flex items-start gap-3 pt-6">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-medium">Como funciona o cadastro?</p>
              <p>
                Ao cadastrar, o dispositivo pedirá confirmação —
                pode ser <strong>PIN do Windows Hello</strong>, senha do sistema, digital ou
                reconhecimento facial. Isso é <strong>normal e esperado</strong>.
              </p>
              <p className="text-xs opacity-80">
                Os dados biométricos nunca saem do dispositivo. Apenas uma chave criptográfica é guardada no servidor.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Dispositivos cadastrados</CardTitle>
              <CardDescription>
                Remova entradas duplicadas ou de dispositivos antigos.
              </CardDescription>
            </div>
            {!loadingList && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                atLimit
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {authenticators.length} / {MAX_CREDENTIALS}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingList ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : authenticators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Fingerprint className="h-10 w-10 mx-auto mb-3 opacity-20" />
              Nenhum dispositivo cadastrado ainda.
            </div>
          ) : (
            authenticators.map((a) => {
              const { type, date } = deviceLabel(a)
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Fingerprint className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{type}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrado em {date}{a.credentialBackedUp ? ' · Sincronizado na nuvem' : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => handleDelete(a.id)}
                    disabled={!!deletingId}
                    className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                    title="Remover"
                  >
                    {deletingId === a.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      {message && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${
          status === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-950/20 border-red-200 text-red-600 dark:text-red-400'
        }`}>
          {status === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {message}
        </div>
      )}

      {/* Botão adicionar */}
      {isSupported && (
        <div className="space-y-2">
          {atLimit && (
            <p className="text-sm text-center text-red-600 dark:text-red-400">
              Limite de {MAX_CREDENTIALS} dispositivos atingido. Remova um antes de adicionar outro.
            </p>
          )}
          <Button
            onClick={handleRegister}
            disabled={status === 'loading' || atLimit}
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {status === 'loading'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação do dispositivo...</>
              : <><Plus className="h-4 w-4" /> Cadastrar este dispositivo</>
            }
          </Button>
          {status === 'loading' && (
            <p className="text-xs text-center text-muted-foreground">
              Confirme o PIN do Windows Hello, digital ou reconhecimento facial quando solicitado.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

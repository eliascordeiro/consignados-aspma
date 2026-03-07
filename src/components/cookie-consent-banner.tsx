"use client"

import { useState } from 'react'
import { useCookieConsent } from '@/hooks/use-cookie-consent'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { Cookie, Settings, X } from 'lucide-react'

export function CookieConsentBanner() {
  const { showBanner, acceptAll, acceptNecessary, acceptCustom } = useCookieConsent()
  const [showSettings, setShowSettings] = useState(false)
  const [customPreferences, setCustomPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  })

  if (!showBanner) return null

  const handleCustomAccept = () => {
    acceptCustom(customPreferences)
    setShowSettings(false)
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
        <Card className="max-w-4xl mx-auto pointer-events-auto shadow-2xl border-2">
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <Cookie className="h-6 w-6 text-primary" />
              </div>
              
              <div className="flex-1 space-y-3">
                <h3 className="font-semibold text-lg">
                  Este site utiliza cookies
                </h3>
                
                <p className="text-sm text-muted-foreground">
                  Utilizamos cookies para melhorar sua experiência, analisar o tráfego do site 
                  e personalizar conteúdo. Ao continuar navegando, você concorda com nossa{' '}
                  <Link 
                    href="/politica-privacidade" 
                    className="underline hover:text-primary"
                  >
                    Política de Privacidade
                  </Link>
                  {' '}e{' '}
                  <Link 
                    href="/termos-uso" 
                    className="underline hover:text-primary"
                  >
                    Termos de Uso
                  </Link>
                  . Conforme a LGPD (Lei Geral de Proteção de Dados), você pode gerenciar 
                  suas preferências de cookies.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button 
                    onClick={acceptAll}
                    size="sm"
                  >
                    Aceitar Todos
                  </Button>
                  
                  <Button 
                    onClick={acceptNecessary}
                    variant="outline"
                    size="sm"
                  >
                    Apenas Necessários
                  </Button>
                  
                  <Button 
                    onClick={() => setShowSettings(true)}
                    variant="ghost"
                    size="sm"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Personalizar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preferências de Cookies</DialogTitle>
            <DialogDescription>
              Gerencie suas preferências de cookies conforme a LGPD
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Cookies Necessários */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b">
              <div className="flex-1">
                <h4 className="font-medium mb-1">Cookies Necessários</h4>
                <p className="text-sm text-muted-foreground">
                  Essenciais para o funcionamento do site. Incluem cookies de autenticação, 
                  segurança e preferências básicas. Não podem ser desativados.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Exemplos: sessão de login, token CSRF, preferências de idioma
                </p>
              </div>
              <Switch 
                checked={true} 
                disabled 
                aria-label="Cookies necessários (sempre ativos)"
              />
            </div>

            {/* Cookies Analíticos */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b">
              <div className="flex-1">
                <h4 className="font-medium mb-1">Cookies Analíticos</h4>
                <p className="text-sm text-muted-foreground">
                  Nos ajudam a entender como os visitantes interagem com o site, 
                  coletando informações de forma anônima.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Exemplos: Google Analytics, métricas de desempenho
                </p>
              </div>
              <Switch 
                checked={customPreferences.analytics}
                onCheckedChange={(checked) => 
                  setCustomPreferences(prev => ({ ...prev, analytics: checked }))
                }
                aria-label="Cookies analíticos"
              />
            </div>

            {/* Cookies de Marketing */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-medium mb-1">Cookies de Marketing</h4>
                <p className="text-sm text-muted-foreground">
                  Utilizados para rastrear visitantes entre sites e exibir anúncios 
                  relevantes e engajadores.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Exemplos: remarketing, publicidade direcionada
                </p>
              </div>
              <Switch 
                checked={customPreferences.marketing}
                onCheckedChange={(checked) => 
                  setCustomPreferences(prev => ({ ...prev, marketing: checked }))
                }
                aria-label="Cookies de marketing"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              onClick={() => setShowSettings(false)} 
              variant="outline"
            >
              Cancelar
            </Button>
            <Button onClick={handleCustomAccept}>
              Salvar Preferências
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

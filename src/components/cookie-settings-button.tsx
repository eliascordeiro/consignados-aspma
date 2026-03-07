"use client"

import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { useCookieConsent } from '@/hooks/use-cookie-consent'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function CookieSettingsButton() {
  const pathname = usePathname()
  const { resetConsent } = useCookieConsent()

  // Não mostrar em páginas de autenticação
  const hideOnPages = ['/portal/login', '/portal/primeiro-acesso', '/portal/redefinir-senha']
  if (pathname && hideOnPages.some(page => pathname.startsWith(page))) {
    return null
  }

  const handleClick = () => {
    resetConsent()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            variant="outline"
            size="icon"
            className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
            aria-label="Gerenciar preferências de cookies"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Gerenciar Cookies</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

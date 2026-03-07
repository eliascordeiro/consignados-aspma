"use client"

import { useState, useEffect } from 'react'

interface CookieConsent {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

const COOKIE_CONSENT_KEY = 'cookie-consent'
const COOKIE_CONSENT_VERSION = '1.0'

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Verificar se já existe consentimento salvo
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY)
    
    if (savedConsent) {
      try {
        const parsed = JSON.parse(savedConsent)
        if (parsed.version === COOKIE_CONSENT_VERSION) {
          setConsent(parsed.consent)
          setShowBanner(false)
        } else {
          // Versão desatualizada, mostrar banner novamente
          setShowBanner(true)
        }
      } catch (error) {
        console.error('Erro ao carregar consentimento de cookies:', error)
        setShowBanner(true)
      }
    } else {
      setShowBanner(true)
    }
  }, [])

  const acceptAll = () => {
    const newConsent: CookieConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
    }
    saveConsent(newConsent)
  }

  const acceptNecessary = () => {
    const newConsent: CookieConsent = {
      necessary: true,
      analytics: false,
      marketing: false,
    }
    saveConsent(newConsent)
  }

  const acceptCustom = (customConsent: CookieConsent) => {
    saveConsent({ ...customConsent, necessary: true }) // Necessários sempre ativos
  }

  const saveConsent = (newConsent: CookieConsent) => {
    setConsent(newConsent)
    setShowBanner(false)
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({
        consent: newConsent,
        version: COOKIE_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      })
    )
  }

  const resetConsent = () => {
    localStorage.removeItem(COOKIE_CONSENT_KEY)
    setConsent(null)
    setShowBanner(true)
  }

  return {
    consent,
    showBanner,
    acceptAll,
    acceptNecessary,
    acceptCustom,
    resetConsent,
  }
}

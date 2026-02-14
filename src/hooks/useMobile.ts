'use client'

import { useState, useEffect } from 'react'

/**
 * Hook para detectar se a tela é mobile.
 * @param breakpoint - largura máxima em pixels para considerar mobile (padrão: 768)
 */
export function useMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  return isMobile
}

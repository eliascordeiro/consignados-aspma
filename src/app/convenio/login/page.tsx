'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConvenioLoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground">
        Redirecionando para o login principal...
      </p>
    </div>
  )
}


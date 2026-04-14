"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldOff } from "lucide-react"

export default function ConvenioBloqueadoPage() {
  useEffect(() => {
    // Limpar o cookie convenio_session via API de logout
    fetch("/api/convenio/auth/logout", { method: "POST" }).catch(() => {})
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ShieldOff className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-xl text-red-700 dark:text-red-400">
            Acesso Bloqueado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Seu convênio está <strong>inativo</strong> no sistema. O acesso ao portal foi suspenso.
          </p>
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">Entre em contato com a ASPMA</p>
            <p>
              Para reativar seu acesso, entre em contato com a administração da
              ASPMA — Associação dos Servidores Públicos Municipais de Araucária.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Voltar ao Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

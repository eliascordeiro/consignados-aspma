'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Relatórios
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Análises e relatórios de vendas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relatórios em Desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
            <BarChart3 className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Em breve
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center">
            Relatórios de comissões, repasses e análises estarão disponíveis em breve
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

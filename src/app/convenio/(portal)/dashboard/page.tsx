'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingCart, TrendingUp, DollarSign, Calendar, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface DashboardStats {
  totalVendas: number
  vendasMesAtual: number
  valorTotalVendas: number
}

interface VendaRecente {
  id: string
  numeroVenda: number
  dataEmissao: string
  socioNome: string
  socioMatricula: string | null
  valorTotal: number
  quantidadeParcelas: number
  ativo: boolean
  cancelado: boolean
}

interface DashboardData {
  stats: DashboardStats
  vendasRecentes: VendaRecente[]
}

export default function ConvenioDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await fetch('/api/convenio/dashboard')
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados')
      }

      const data = await response.json()
      setData(data)
    } catch (error) {
      console.error('Erro:', error)
      setError('Erro ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center text-red-600 p-8">
        {error || 'Erro ao carregar dados'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visão geral das suas vendas
          </p>
        </div>
        <Link href="/convenio/vendas/nova">
          <Button className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Nova Venda
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total de Vendas
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalVendas}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Vendas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Vendas deste Mês
            </CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.vendasMesAtual}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Valor Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Number(data.stats.valorTotalVendas))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Em vendas ativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vendas Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.vendasRecentes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma venda registrada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {data.vendasRecentes.map((venda) => (
                <div
                  key={venda.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {venda.socioNome}
                      {venda.socioMatricula && (
                        <span className="text-sm text-gray-500 ml-2">
                          Mat: {venda.socioMatricula}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Venda #{venda.numeroVenda} •{' '}
                      {format(new Date(venda.dataEmissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(Number(venda.valorTotal))}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {venda.quantidadeParcelas}x de{' '}
                      {formatCurrency(Number(venda.valorTotal) / venda.quantidadeParcelas)}
                    </div>
                    {venda.cancelado && (
                      <span className="text-xs text-red-600 font-medium">
                        CANCELADA
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {data.vendasRecentes.length > 0 && (
            <div className="mt-4 text-center">
              <Link href="/convenio/vendas">
                <Button variant="outline">
                  Ver Todas as Vendas
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

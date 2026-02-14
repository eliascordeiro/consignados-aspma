'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  ShoppingCart, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingDown,
  Info,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DashboardStats {
  // Descontos do mês atual
  parcelasMesAtual: number
  valorMesAtual: number

  // Meses anteriores (já recebidos)
  parcelasMesesAnteriores: number
  valorMesesAnteriores: number

  // Meses futuros (a receber)
  parcelasMesesFuturos: number
  valorMesesFuturos: number

  // Vendas canceladas
  vendasCanceladas: number
  parcelasCanceladas: number

  // Totais
  totalVendasAtivas: number
  vendasRegistradasMes: number

  // Referência do mês
  mesReferencia: string
}

interface VendaRecente {
  id: string
  numeroVenda: number
  dataEmissao: string
  socioNome: string
  socioMatricula: string | null
  valorTotal: number
  quantidadeParcelas: number
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral das suas vendas
          </p>
        </div>
        <Link href="/convenio/vendas/nova">
          <Button className="gap-2 w-full sm:w-auto">
            <ShoppingCart className="h-4 w-4" />
            Nova Venda
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Descontos do Mês Atual */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Descontos de {data.stats.mesReferencia}
              </CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <CardDescription className="text-xs">
              Parcelas com vencimento este mês
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.parcelasMesAtual}
            </div>
            <div className="text-sm text-muted-foreground">
              Parcelas a receber
            </div>
            <div className="font-semibold text-primary text-lg">
              {formatCurrency(Number(data.stats.valorMesAtual))}
            </div>
          </CardContent>
        </Card>

        {/* Meses Futuros */}
        <Card className="border-l-4 border-l-chart-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Próximos Meses
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-chart-2" />
            </div>
            <CardDescription className="text-xs">
              Parcelas com vencimento futuro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.parcelasMesesFuturos}
            </div>
            <div className="text-sm text-muted-foreground">
              Parcelas a vencer
            </div>
            <div className="font-semibold text-chart-2 text-lg">
              {formatCurrency(Number(data.stats.valorMesesFuturos))}
            </div>
          </CardContent>
        </Card>

        {/* Meses Anteriores */}
        <Card className="border-l-4 border-l-chart-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Meses Anteriores
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-chart-3" />
            </div>
            <CardDescription className="text-xs">
              Parcelas já processadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.parcelasMesesAnteriores}
            </div>
            <div className="text-sm text-muted-foreground">
              Parcelas recebidas
            </div>
            <div className="font-semibold text-chart-3 text-lg">
              {formatCurrency(Number(data.stats.valorMesesAnteriores))}
            </div>
          </CardContent>
        </Card>

        {/* Total de Vendas */}
        <Card className="border-l-4 border-l-accent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Vendas
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-accent-foreground" />
            </div>
            <CardDescription className="text-xs">
              Vendas ativas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.totalVendasAtivas}
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <div>{data.stats.vendasRegistradasMes} registradas este mês</div>
              {data.stats.vendasCanceladas > 0 && (
                <div className="text-destructive">
                  {data.stats.vendasCanceladas} canceladas
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="bg-muted/50">
        <CardContent className="flex gap-3 py-4">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Controle Mensal de Descontos:</strong> Este dashboard mostra os descontos 
            organizados por mês de vencimento. Em <strong>{data.stats.mesReferencia}</strong> você receberá <strong className="text-primary">
            {data.stats.parcelasMesAtual} parcelas</strong> no valor de <strong className="text-primary">
            {formatCurrency(Number(data.stats.valorMesAtual))}</strong>. As parcelas são contabilizadas independente do status 
            de baixa (que controla apenas o desconto em folha dos sócios). <strong className="text-destructive">Vendas canceladas</strong> nunca 
            são incluídas nos valores a receber.
          </div>
        </CardContent>
      </Card>

      {/* Vendas Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Vendas Registradas</CardTitle>
          <CardDescription>
            As 10 vendas mais recentes do seu convênio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.vendasRecentes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda registrada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {data.vendasRecentes.map((venda) => (
                <div
                  key={venda.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg transition-colors ${
                    venda.cancelado 
                      ? 'bg-destructive/10 border border-destructive/20' 
                      : 'bg-muted hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {venda.cancelado ? (
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    ) : (
                      <ShoppingCart className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {venda.socioNome}
                        {venda.socioMatricula && (
                          <span className="text-sm text-muted-foreground ml-2">
                            Mat: {venda.socioMatricula}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Venda #{venda.numeroVenda} •{' '}
                        {format(new Date(venda.dataEmissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`font-semibold ${
                        venda.cancelado ? 'text-destructive line-through' : 'text-foreground'
                      }`}>
                        {formatCurrency(Number(venda.valorTotal))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {venda.quantidadeParcelas}x de{' '}
                        {formatCurrency(Number(venda.valorTotal) / venda.quantidadeParcelas)}
                      </div>
                    </div>
                    {venda.cancelado && (
                      <Badge variant="destructive" className="flex-shrink-0">
                        Cancelada
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {data.vendasRecentes.length > 0 && (
            <div className="mt-4 text-center">
              <Link href="/convenio/vendas">
                <Button variant="outline" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
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

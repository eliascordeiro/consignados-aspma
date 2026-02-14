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
  // Vendas ativas (com parcelas >= mês atual)
  vendasAtivas: number
  parcelasAtivas: number
  valorAtivo: number

  // Vendas quitadas (todas parcelas < mês atual)
  vendasQuitadas: number
  parcelasQuitadas: number
  valorQuitado: number

  // Vendas canceladas
  vendasCanceladas: number
  parcelasCanceladas: number
  valorCancelado: number

  // Vendas do mês (por data de emissão)
  vendasMesAtual: number

  // Data de corte
  dataCorte: string
}

interface VendaRecente {
  id: string
  numeroVenda: number
  dataEmissao: string
  socioNome: string
  socioMatricula: string | null
  valorTotal: number
  quantidadeParcelas: number
  status: 'ativa' | 'quitada' | 'cancelada'
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Vendas Ativas */}
        <Card className="border-l-4 border-l-chart-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas Ativas
              </CardTitle>
              <Clock className="h-4 w-4 text-chart-2" />
            </div>
            <CardDescription className="text-xs">
              Parcelas com vencimento a partir de {format(new Date(data.stats.dataCorte), 'MM/yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.vendasAtivas}
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <div>{data.stats.parcelasAtivas} parcelas pendentes</div>
              <div className="font-semibold text-chart-2">
                {formatCurrency(Number(data.stats.valorAtivo))} a receber
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendas Quitadas */}
        <Card className="border-l-4 border-l-chart-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas Quitadas
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-chart-3" />
            </div>
            <CardDescription className="text-xs">
              Todas as parcelas anteriores a {format(new Date(data.stats.dataCorte), 'MM/yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.vendasQuitadas}
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <div>{data.stats.parcelasQuitadas} parcelas quitadas</div>
              <div className="font-semibold text-chart-3">
                {formatCurrency(Number(data.stats.valorQuitado))} recebido
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendas Canceladas */}
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas Canceladas
              </CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <CardDescription className="text-xs">
              Vendas canceladas (não serão recebidas)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.vendasCanceladas}
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <div>{data.stats.parcelasCanceladas} parcelas canceladas</div>
              <div className="font-semibold text-destructive">
                {formatCurrency(Number(data.stats.valorCancelado))} perdido
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendas deste Mês */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Novas Vendas
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <CardDescription className="text-xs">
              Vendas realizadas em {format(new Date(), 'MMMM/yyyy', { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.vendasMesAtual}
            </div>
            <div className="text-sm text-muted-foreground">
              Emitidas este mês
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="bg-muted/50">
        <CardContent className="flex gap-3 py-4">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Como funciona:</strong> As vendas são classificadas pela 
            data de vencimento das parcelas. Parcelas com vencimento <strong>a partir de {format(new Date(data.stats.dataCorte), 'MM/yyyy')}</strong> são 
            consideradas <strong className="text-chart-2">ativas</strong> (a receber). Parcelas anteriores são 
            <strong className="text-chart-3"> quitadas</strong>. Vendas <strong className="text-destructive">canceladas</strong> são 
            sempre separadas, independente da data.
          </div>
        </CardContent>
      </Card>

      {/* Vendas Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Vendas</CardTitle>
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
              {data.vendasRecentes.map((venda) => {
                // Define cores e ícones por status
                const statusConfig = {
                  ativa: {
                    badge: 'Ativa',
                    variant: 'default' as const,
                    color: 'text-chart-2',
                    icon: Clock,
                  },
                  quitada: {
                    badge: 'Quitada',
                    variant: 'secondary' as const,
                    color: 'text-chart-3',
                    icon: CheckCircle2,
                  },
                  cancelada: {
                    badge: 'Cancelada',
                    variant: 'destructive' as const,
                    color: 'text-destructive',
                    icon: XCircle,
                  },
                }

                const config = statusConfig[venda.status]
                const StatusIcon = config.icon

                return (
                  <div
                    key={venda.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <StatusIcon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
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
                        <div className="font-semibold text-foreground">
                          {formatCurrency(Number(venda.valorTotal))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {venda.quantidadeParcelas}x de{' '}
                          {formatCurrency(Number(venda.valorTotal) / venda.quantidadeParcelas)}
                        </div>
                      </div>
                      <Badge variant={config.variant} className="flex-shrink-0">
                        {config.badge}
                      </Badge>
                    </div>
                  </div>
                )
              })}
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

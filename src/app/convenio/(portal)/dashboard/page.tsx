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
  Building2,
  Phone,
  Mail,
  MapPin,
  Landmark,
  Percent,
  CreditCard,
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
  totalVendasEmAndamento: number
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

interface ConvenioPerfil {
  razaoSocial: string | null
  fantasia: string | null
  nome: string | null
  cnpj: string | null
  desconto: number | null
  parcelas: number | null
  endereco: string | null
  bairro: string | null
  cep: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  fax: string | null
  contato: string | null
  email: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
}

interface DashboardData {
  stats: DashboardStats
  perfil: ConvenioPerfil
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

        {/* Vendas em Andamento */}
        <Card className="border-l-4 border-l-accent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas em Andamento
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-accent-foreground" />
            </div>
            <CardDescription className="text-xs">
              Com parcelas a vencer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-foreground">
              {data.stats.totalVendasEmAndamento}
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

      {/* Perfil do Convênio */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Dados do Convênio</CardTitle>
          </div>
          <CardDescription>Informações cadastrais do seu convênio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Razão Social / Fantasia */}
            {(data.perfil.razaoSocial || data.perfil.fantasia) && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Razão Social / Fantasia</p>
                <p className="font-medium text-sm">{data.perfil.razaoSocial || '-'}</p>
                {data.perfil.fantasia && (
                  <p className="text-sm text-muted-foreground">{data.perfil.fantasia}</p>
                )}
              </div>
            )}

            {/* CNPJ */}
            {data.perfil.cnpj && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">CNPJ / CGC</p>
                <p className="font-medium text-sm">{data.perfil.cnpj}</p>
              </div>
            )}

            {/* Contato */}
            {data.perfil.contato && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Contato</p>
                <p className="font-medium text-sm">{data.perfil.contato}</p>
              </div>
            )}

            {/* Telefone / Fax */}
            {(data.perfil.telefone || data.perfil.fax) && (
              <div className="space-y-0.5 flex gap-3 items-start">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Telefone{data.perfil.fax ? ' / Fax' : ''}</p>
                  {data.perfil.telefone && <p className="font-medium text-sm">{data.perfil.telefone}</p>}
                  {data.perfil.fax && <p className="text-sm text-muted-foreground">{data.perfil.fax}</p>}
                </div>
              </div>
            )}

            {/* E-mail */}
            {data.perfil.email && (
              <div className="space-y-0.5 flex gap-3 items-start">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">E-mail</p>
                  <p className="font-medium text-sm break-all">{data.perfil.email}</p>
                </div>
              </div>
            )}

            {/* Endereço */}
            {(data.perfil.endereco || data.perfil.cidade) && (
              <div className="space-y-0.5 flex gap-3 items-start">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Endereço</p>
                  {data.perfil.endereco && <p className="font-medium text-sm">{data.perfil.endereco}{data.perfil.bairro ? ` - ${data.perfil.bairro}` : ''}</p>}
                  {(data.perfil.cidade || data.perfil.estado) && (
                    <p className="text-sm text-muted-foreground">
                      {[data.perfil.cidade, data.perfil.estado].filter(Boolean).join(' - ')}
                      {data.perfil.cep ? ` | CEP: ${data.perfil.cep}` : ''}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Banco */}
            {(data.perfil.banco || data.perfil.agencia || data.perfil.conta) && (
              <div className="space-y-0.5 flex gap-3 items-start">
                <Landmark className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Dados Bancários</p>
                  {data.perfil.banco && <p className="font-medium text-sm">Banco: {data.perfil.banco}</p>}
                  {data.perfil.agencia && <p className="text-sm text-muted-foreground">Agência: {data.perfil.agencia}</p>}
                  {data.perfil.conta && <p className="text-sm text-muted-foreground">Conta: {data.perfil.conta}</p>}
                </div>
              </div>
            )}

            {/* Desconto e Parcelas */}
            {(data.perfil.desconto != null || data.perfil.parcelas != null) && (
              <div className="space-y-0.5 flex gap-3 items-start">
                <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Condições Comerciais</p>
                  {data.perfil.desconto != null && (
                    <p className="font-medium text-sm">Desconto: {data.perfil.desconto}%</p>
                  )}
                  {data.perfil.parcelas != null && (
                    <p className="text-sm text-muted-foreground">Máx. parcelas: {data.perfil.parcelas}x</p>
                  )}
                </div>
              </div>
            )}
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

'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  ShoppingCart,
  Calendar,
  User,
  DollarSign,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  X,
  Plus,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Parcela {
  id: string
  numeroParcela: number
  dataVencimento: string
  valor: number
  baixa: string | null
  dataBaixa: string | null
}

interface Venda {
  id: string
  numeroVenda: number
  dataEmissao: string
  valorTotal: number
  quantidadeParcelas: number
  valorParcela: number
  observacoes: string | null
  ativo: boolean
  cancelado: boolean
  socio: {
    nome: string
    matricula: string | null
    cpf: string | null
  }
  parcelasPagas: number
  parcelas?: Parcela[]
}

interface VendasResponse {
  vendas: Venda[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    valorTotalGeral: number
    totalParcelas: number
    valorTotalParcelas: number
  }
}

async function fetchVendas({
  page = 1,
  busca,
  status,
  dataInicio,
  dataFim,
}: {
  page?: number
  busca: string
  status: string
  dataInicio: string
  dataFim: string
}): Promise<VendasResponse> {
  const params = new URLSearchParams()
  
  params.set('page', page.toString())
  params.set('limit', '50')
  
  if (busca.trim()) params.set('busca', busca.trim())
  if (status) params.set('status', status)
  if (dataInicio) params.set('dataInicio', dataInicio)
  if (dataFim) params.set('dataFim', dataFim)

  const qs = params.toString()
  const url = '/api/convenio/vendas' + (qs ? '?' + qs : '')
  
  console.log('🔵 Fetching vendas from:', url)
  console.log('🔵 Cookies:', document.cookie)
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'include', // Garantir envio de cookies
    })
    
    clearTimeout(timeoutId)

    console.log('🔵 Response status:', response.status)
    console.log('🔵 Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ Error response:', response.status, errorData)
      throw new Error(errorData.error || 'Erro ao carregar vendas')
    }

    const data = await response.json()
    console.log('✅ Vendas loaded:', data.vendas?.length || 0)
    
    return {
      vendas: data.vendas || [],
      pagination: data.pagination || {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
        valorTotalGeral: 0,
        totalParcelas: 0,
        valorTotalParcelas: 0
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout')
      throw new Error('Timeout ao carregar vendas - servidor não respondeu em 10 segundos')
    }
    console.error('❌ Fetch error:', error)
    throw error
  }
}

async function fetchParcelas(vendaId: string): Promise<Parcela[]> {
  const response = await fetch('/api/convenio/vendas/' + vendaId + '/parcelas')

  if (!response.ok) {
    throw new Error('Erro ao carregar parcelas')
  }

  const data = await response.json()
  return data.parcelas || []
}

export default function VendasPage() {
  const [vendaExpandida, setVendaExpandida] = useState<string | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Check mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [busca, statusFiltro, dataInicio, dataFim])

  // Query vendas com React Query
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['convenio-vendas', busca, statusFiltro, dataInicio, dataFim, currentPage],
    queryFn: () =>
      fetchVendas({
        page: currentPage,
        busca,
        status: statusFiltro,
        dataInicio,
        dataFim,
      }),
    staleTime: 60000, // 1 minuto
    refetchOnWindowFocus: false,
    retry: 2,
  })

  const vendas = data?.vendas ?? []
  const pagination = data?.pagination

  console.log('Query state:', { isLoading, error, vendasCount: vendas.length })

  // Query parcelas sob demanda
  const { data: parcelasMap = {} } = useQuery({
    queryKey: ['convenio-parcelas', vendaExpandida],
    queryFn: async () => {
      if (!vendaExpandida) return {}
      const parcelas = await fetchParcelas(vendaExpandida)
      return { [vendaExpandida]: parcelas }
    },
    enabled: !!vendaExpandida,
    staleTime: 60000, // 1 minuto
  })

  const limparFiltros = () => {
    setBusca('')
    setStatusFiltro('')
    setDataInicio('')
    setDataFim('')
  }

  const temFiltrosAtivos = busca || statusFiltro || dataInicio || dataFim

  const toggleVenda = (vendaId: string) => {
    if (vendaExpandida === vendaId) {
      setVendaExpandida(null)
    } else {
      setVendaExpandida(vendaId)
    }
  }

  const getStatusBadge = (venda: Venda) => {
    if (venda.cancelado) return <Badge variant="destructive">Cancelada</Badge>
    if (venda.ativo) return <Badge variant="default">Ativa</Badge>
    return <Badge variant="secondary">Inativa</Badge>
  }

  const rowVirtualizer = useVirtualizer({
    count: vendas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 280 : 100),
    overscan: 5,
  })

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Tabela de Vendas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {vendas.length}{' '}
            {vendas.length === 1 ? 'venda encontrada' : 'vendas encontradas'}
          </p>
        </div>
        <Link href="/convenio/vendas/nova">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Venda
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-base">Filtros</CardTitle>
              {temFiltrosAtivos && (
                <Badge variant="secondary" className="ml-2">
                  Filtros ativos
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {temFiltrosAtivos && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltrosAbertos(!filtrosAbertos)}
              >
                {filtrosAbertos ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {filtrosAbertos && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Busca por nome/matrícula/cpf */}
              <div className="space-y-2">
                <Label htmlFor="busca">Nome, Matrícula ou CPF</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="busca"
                    placeholder="Buscar..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={statusFiltro}
                  onChange={e => setStatusFiltro(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Todos</option>
                  <option value="ativa">Ativa</option>
                  <option value="quitada">Quitada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              {/* Data início */}
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                />
              </div>

              {/* Data fim */}
              <div className="space-y-2">
                <Label htmlFor="dataFim">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Loading */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-sm text-gray-500">Carregando vendas...</p>
        </div>
      ) : error ? (
        /* Erro */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-red-100 dark:bg-red-900 rounded-full mb-4">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Erro ao carregar vendas
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
              {error instanceof Error ? error.message : 'Erro desconhecido'}
            </p>
            <Button onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : vendas.length === 0 ? (
        /* Sem resultados */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <ShoppingCart className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {temFiltrosAtivos
                ? 'Nenhuma venda encontrada'
                : 'Nenhuma venda registrada'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
              {temFiltrosAtivos
                ? 'Tente ajustar os filtros para encontrar vendas'
                : 'Comece cadastrando sua primeira venda'}
            </p>
            {temFiltrosAtivos ? (
              <Button variant="outline" onClick={limparFiltros}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            ) : (
              <Link href="/convenio/vendas/nova">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeira Venda
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Lista de Vendas com Virtualização */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: '600px' }}
          >
            <div className="w-full">
              {/* Virtual scrolling container */}
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const venda = vendas[virtualRow.index]
                  const percentualPago = (venda.parcelasPagas / venda.quantidadeParcelas) * 100
                  const parcelas = parcelasMap[venda.id] || []

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <Card className="m-2 overflow-hidden">
                        <CardHeader
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors py-3"
                          onClick={() => toggleVenda(venda.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <CardTitle className="text-base">
                                  Venda #{venda.numeroVenda}
                                </CardTitle>
                                {getStatusBadge(venda)}
                              </div>

                              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-sm">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <User className="h-4 w-4" />
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {venda.socio.nome}
                                    </div>
                                    {venda.socio.matricula && (
                                      <div className="text-xs">
                                        Mat: {venda.socio.matricula}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <Calendar className="h-4 w-4" />
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {format(new Date(venda.dataEmissao), 'dd/MM/yyyy', {
                                        locale: ptBR,
                                      })}
                                    </div>
                                    <div className="text-xs">
                                      {format(new Date(venda.dataEmissao), 'HH:mm', {
                                        locale: ptBR,
                                      })}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <DollarSign className="h-4 w-4" />
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {formatCurrency(Number(venda.valorTotal))}
                                    </div>
                                    <div className="text-xs">
                                      {venda.quantidadeParcelas}x de{' '}
                                      {formatCurrency(Number(venda.valorParcela))}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {venda.parcelasPagas}/{venda.quantidadeParcelas} pagas
                                    </div>
                                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                                      <div
                                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                                        style={{ width: percentualPago + '%' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        {vendaExpandida === venda.id && (
                          <CardContent className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            {venda.observacoes && (
                              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Observações:
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {venda.observacoes}
                                </div>
                              </div>
                            )}

                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Parcelas:
                            </div>

                            {parcelas.length === 0 ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                              </div>
                            ) : (
                              <>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-20">Nº</TableHead>
                                        <TableHead>Vencimento (Mês/Ano)</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Data Pagamento</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {parcelas.map(parcela => (
                                        <TableRow key={parcela.id}>
                                          <TableCell className="font-medium">
                                            {parcela.numeroParcela}
                                          </TableCell>
                                          <TableCell>
                                            {format(
                                              new Date(parcela.dataVencimento),
                                              'MM/yyyy',
                                              { locale: ptBR }
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {formatCurrency(Number(parcela.valor))}
                                          </TableCell>
                                          <TableCell>
                                            {parcela.baixa === 'S' ? (
                                              <Badge variant="default" className="gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Paga
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary" className="gap-1">
                                                <XCircle className="h-3 w-3" />
                                                Pendente
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {parcela.dataBaixa
                                              ? format(
                                                  new Date(parcela.dataBaixa),
                                                  'dd/MM/yyyy',
                                                  { locale: ptBR }
                                                )
                                              : '-'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Total pago:{' '}
                                    {formatCurrency(
                                      venda.parcelasPagas * Number(venda.valorParcela)
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Restante:{' '}
                                    {formatCurrency(
                                      (venda.quantidadeParcelas - venda.parcelasPagas) *
                                        Number(venda.valorParcela)
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Paginação e Sumários */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Mostrando <strong>{vendas.length}</strong> de <strong>{pagination?.total || 0}</strong> vendas
                {pagination && ` (Página ${pagination.page} de ${pagination.totalPages})`}
              </div>
              
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Primeira página"
                  >
                    ««
                  </button>
                  
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Página anterior"
                  >
                    «
                  </button>
                  
                  {/* Números de página */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Próxima página"
                  >
                    »
                  </button>
                  
                  <button
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={currentPage === pagination.totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Última página"
                  >
                    »»
                  </button>
                </div>
              )}
              
              {pagination && pagination.totalParcelas > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-gray-500 dark:text-gray-400">Valor total:</span>{' '}
                  <strong>
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency',
                      currency: 'BRL'
                    }).format(Number(pagination.valorTotalParcelas || 0))}
                  </strong>
                  <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">
                    ({pagination.totalParcelas} parcela{pagination.totalParcelas !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

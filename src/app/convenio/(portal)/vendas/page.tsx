'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ShoppingCart, Calendar, User, DollarSign, CheckCircle2, XCircle } from 'lucide-react'
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
  parcelas?: Parcela[] // Opcional - carregado sob demanda
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [vendaExpandida, setVendaExpandida] = useState<string | null>(null)
  const [loadingParcelas, setLoadingParcelas] = useState<string | null>(null)

  useEffect(() => {
    loadVendas()
  }, [])

  const loadVendas = async () => {
    try {
      const response = await fetch('/api/convenio/vendas')
      const data = await response.json()
      setVendas(data.vendas || [])
    } catch (error) {
      console.error('Erro ao carregar vendas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadParcelas = async (vendaId: string) => {
    setLoadingParcelas(vendaId)
    try {
      const response = await fetch(`/api/convenio/vendas/${vendaId}/parcelas`)
      const data = await response.json()
      
      // Atualiza a venda com as parcelas carregadas
      setVendas(vendas.map(v => 
        v.id === vendaId ? { ...v, parcelas: data.parcelas } : v
      ))
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error)
    } finally {
      setLoadingParcelas(null)
    }
  }

  const toggleVenda = async (vendaId: string) => {
    const venda = vendas.find(v => v.id === vendaId)
    
    if (vendaExpandida === vendaId) {
      // Fechando
      setVendaExpandida(null)
    } else {
      // Abrindo
      setVendaExpandida(vendaId)
      
      // Se ainda não tem parcelas carregadas, busca
      if (venda && !venda.parcelas) {
        await loadParcelas(vendaId)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Minhas Vendas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {vendas.length} {vendas.length === 1 ? 'venda registrada' : 'vendas registradas'}
          </p>
        </div>
        <Link href="/convenio/vendas/nova">
          <Button className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Nova Venda
          </Button>
        </Link>
      </div>

      {/* Lista de Vendas */}
      {vendas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <ShoppingCart className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhuma venda registrada
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
              Comece cadastrando sua primeira venda
            </p>
            <Link href="/convenio/vendas/nova">
              <Button>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Cadastrar Primeira Venda
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vendas.map((venda) => {
            const percentualPago = (venda.parcelasPagas / venda.quantidadeParcelas) * 100

            return (
              <Card key={venda.id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => toggleVenda(venda.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">
                          Venda #{venda.numeroVenda}
                        </CardTitle>
                        {venda.cancelado ? (
                          <Badge variant="destructive">Cancelada</Badge>
                        ) : venda.ativo ? (
                          <Badge variant="default">Ativa</Badge>
                        ) : (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                      </div>
                      
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {venda.socio.nome}
                            </div>
                            {venda.socio.matricula && (
                              <div className="text-xs">Mat: {venda.socio.matricula}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Calendar className="h-4 w-4" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {format(new Date(venda.dataEmissao), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                            <div className="text-xs">
                              {format(new Date(venda.dataEmissao), 'HH:mm', { locale: ptBR })}
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
                              {venda.quantidadeParcelas}x de {formatCurrency(Number(venda.valorParcela))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {venda.parcelasPagas}/{venda.quantidadeParcelas} pagas
                            </div>
                            <div className="text-xs">
                              {percentualPago.toFixed(0)}% concluído
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
                    
                    {loadingParcelas === venda.id ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    ) : venda.parcelas ? (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20">Nº</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Data Pagamento</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {venda.parcelas.map((parcela) => (
                                <TableRow key={parcela.id}>
                                  <TableCell className="font-medium">
                                    {parcela.numeroParcela}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(parcela.dataVencimento), 'dd/MM/yyyy', { locale: ptBR })}
                                  </TableCell>
                                  <TableCell>{formatCurrency(Number(parcela.valor))}</TableCell>
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
                                  ? format(new Date(parcela.dataBaixa), 'dd/MM/yyyy', { locale: ptBR })
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total pago: {formatCurrency(venda.parcelasPagas * Number(venda.valorParcela))}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Restante: {formatCurrency((venda.quantidadeParcelas - venda.parcelasPagas) * Number(venda.valorParcela))}
                      </div>
                    </div>
                      </>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

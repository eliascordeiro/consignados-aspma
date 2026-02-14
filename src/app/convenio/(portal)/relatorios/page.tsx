'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils'

interface VendasPeriodoData {
  periodo: { inicio: string; fim: string }
  resumo: {
    totalVendas: number
    valorTotal: number
    totalParcelas: number
    ticketMedio: number
    vendasAtivas: number
    vendasQuitadas: number
    vendasCanceladas: number
    valorRecebido: number
    valorAReceber: number
  }
  vendasPorDia: Array<{ data: string; quantidade: number; valor: number }>
  vendas: Array<{
    id: string
    numeroVenda: number
    dataEmissao: string
    socio: string
    matricula: string | null
    valorTotal: number
    quantidadeParcelas: number
    valorParcela: number
    status: string
  }>
}

interface ParcelasReceberData {
  periodo: { mesVencimento: string; dataInicio: string; dataFim: string }
  resumo: {
    totalParcelas: number
    valorTotal: number
    parcelasPagas: number
    valorPago: number
    parcelasPendentes: number
    valorPendente: number
    percentualPago: number
  }
  parcelasPorDia: Array<{
    data: string
    quantidade: number
    valor: number
    pagas: number
    pendentes: number
  }>
  parcelas: Array<{
    id: string
    numeroParcela: number
    dataVencimento: string
    valor: number
    baixa: string | null
    dataBaixa: string | null
    venda: {
      numeroVenda: number
      socio: string
      matricula: string | null
      cpf: string | null
    }
  }>
}

export default function RelatoriosPage() {
  const [tipoRelatorio, setTipoRelatorio] = useState<'vendas' | 'parcelas'>('vendas')
  
  // Estados para Vendas do Período
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [vendasData, setVendasData] = useState<VendasPeriodoData | null>(null)
  const [loadingVendas, setLoadingVendas] = useState(false)

  // Estados para Parcelas a Receber
  const [mesVencimento, setMesVencimento] = useState('')
  const [statusParcelas, setStatusParcelas] = useState('todas')
  const [parcelasData, setParcelasData] = useState<ParcelasReceberData | null>(null)
  const [loadingParcelas, setLoadingParcelas] = useState(false)

  const gerarRelatorioVendas = async () => {
    if (!dataInicio || !dataFim) {
      alert('Preencha as datas de início e fim')
      return
    }

    setLoadingVendas(true)
    try {
      const params = new URLSearchParams({
        dataInicio,
        dataFim,
      })
      
      const response = await fetch(`/api/convenio/relatorios/vendas-periodo?${params}`)
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório')
      }

      const data = await response.json()
      setVendasData(data)
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao gerar relatório de vendas')
    } finally {
      setLoadingVendas(false)
    }
  }

  const gerarRelatorioParcelas = async () => {
    if (!mesVencimento) {
      alert('Selecione o mês de vencimento')
      return
    }

    setLoadingParcelas(true)
    try {
      const params = new URLSearchParams({
        mesVencimento,
        status: statusParcelas,
      })
      
      const response = await fetch(`/api/convenio/relatorios/parcelas-receber?${params}`)
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório')
      }

      const data = await response.json()
      setParcelasData(data)
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao gerar relatório de parcelas')
    } finally {
      setLoadingParcelas(false)
    }
  }

  const exportarCSV = (tipo: 'vendas' | 'parcelas') => {
    if (tipo === 'vendas' && vendasData) {
      const csv = [
        ['Nº Venda', 'Data', 'Sócio', 'Matrícula', 'Valor Total', 'Parcelas', 'Valor Parcela', 'Status'].join(';'),
        ...vendasData.vendas.map(v =>
          [
            v.numeroVenda,
            format(new Date(v.dataEmissao), 'dd/MM/yyyy'),
            v.socio,
            v.matricula || '',
            v.valorTotal.toFixed(2).replace('.', ','),
            v.quantidadeParcelas,
            v.valorParcela.toFixed(2).replace('.', ','),
            v.status,
          ].join(';')
        ),
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `vendas_${dataInicio}_${dataFim}.csv`
      link.click()
    } else if (tipo === 'parcelas' && parcelasData) {
      const csv = [
        ['Nº Venda', 'Parcela', 'Vencimento', 'Valor', 'Status', 'Data Pagamento', 'Sócio', 'Matrícula'].join(';'),
        ...parcelasData.parcelas.map(p =>
          [
            p.venda.numeroVenda,
            p.numeroParcela,
            format(new Date(p.dataVencimento), 'MM/yyyy'),
            p.valor.toFixed(2).replace('.', ','),
            p.baixa === 'S' ? 'Paga' : 'Pendente',
            p.dataBaixa ? format(new Date(p.dataBaixa), 'dd/MM/yyyy') : '',
            p.venda.socio,
            p.venda.matricula || '',
          ].join(';')
        ),
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `parcelas_${mesVencimento}.csv`
      link.click()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Relatórios
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Análises e relatórios gerenciais
        </p>
      </div>

      {/* Seleção de Tipo de Relatório */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione o Tipo de Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={tipoRelatorio === 'vendas' ? 'default' : 'outline'}
              onClick={() => setTipoRelatorio('vendas')}
              className="flex-1"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Vendas do Período
            </Button>
            <Button
              variant={tipoRelatorio === 'parcelas' ? 'default' : 'outline'}
              onClick={() => setTipoRelatorio('parcelas')}
              className="flex-1"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Parcelas a Receber
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relatório de Vendas do Período */}
      {tipoRelatorio === 'vendas' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Vendas do Período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataFim">Data Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={gerarRelatorioVendas}
                    disabled={loadingVendas}
                    className="w-full"
                  >
                    {loadingVendas ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Gerar Relatório
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {vendasData && (
            <>
              {/* Cards de Resumo */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{vendasData.resumo.totalVendas}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      {vendasData.resumo.totalParcelas} parcelas geradas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(vendasData.resumo.valorTotal)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Ticket médio: {formatCurrency(vendasData.resumo.ticketMedio)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Já Recebido</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(vendasData.resumo.valorRecebido)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {((vendasData.resumo.valorRecebido / vendasData.resumo.valorTotal) * 100).toFixed(1)}% do total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">A Receber</CardTitle>
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(vendasData.resumo.valorAReceber)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {((vendasData.resumo.valorAReceber / vendasData.resumo.valorTotal) * 100).toFixed(1)}% do total
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Status das Vendas */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Status das Vendas</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarCSV('vendas')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{vendasData.resumo.vendasAtivas}</Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Ativas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600 hover:bg-green-700">
                        {vendasData.resumo.vendasQuitadas}
                      </Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Quitadas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{vendasData.resumo.vendasCanceladas}</Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Canceladas</span>
                    </div>
                  </div>

                  {/* Tabela de Vendas */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Sócio</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-center">Parcelas</TableHead>
                          <TableHead className="text-right">Valor Parcela</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendasData.vendas.map((venda) => (
                          <TableRow key={venda.id}>
                            <TableCell className="font-medium">#{venda.numeroVenda}</TableCell>
                            <TableCell>
                              {format(new Date(venda.dataEmissao), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>{venda.socio}</TableCell>
                            <TableCell>{venda.matricula || '-'}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(venda.valorTotal))}
                            </TableCell>
                            <TableCell className="text-center">{venda.quantidadeParcelas}x</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(venda.valorParcela))}
                            </TableCell>
                            <TableCell>
                              {venda.status === 'cancelada' && (
                                <Badge variant="destructive">Cancelada</Badge>
                              )}
                              {venda.status === 'quitada' && (
                                <Badge className="bg-green-600 hover:bg-green-700">Quitada</Badge>
                              )}
                              {venda.status === 'ativa' && <Badge variant="default">Ativa</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Relatório de Parcelas a Receber */}
      {tipoRelatorio === 'parcelas' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Parcelas a Receber</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="mesVencimento">Mês de Vencimento</Label>
                  <Input
                    id="mesVencimento"
                    type="month"
                    value={mesVencimento}
                    onChange={(e) => setMesVencimento(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statusParcelas">Status</Label>
                  <select
                    id="statusParcelas"
                    value={statusParcelas}
                    onChange={(e) => setStatusParcelas(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="todas">Todas</option>
                    <option value="pagas">Pagas</option>
                    <option value="pendentes">Pendentes</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={gerarRelatorioParcelas}
                    disabled={loadingParcelas}
                    className="w-full"
                  >
                    {loadingParcelas ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Gerar Relatório
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {parcelasData && (
            <>
              {/* Cards de Resumo */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total de Parcelas</CardTitle>
                    <Calendar className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{parcelasData.resumo.totalParcelas}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(parcelasData.periodo.dataInicio), "MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(parcelasData.resumo.valorTotal)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Média: {formatCurrency(parcelasData.resumo.valorTotal / parcelasData.resumo.totalParcelas)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Parcelas Pagas</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(parcelasData.resumo.valorPago)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {parcelasData.resumo.parcelasPagas} parcelas ({parcelasData.resumo.percentualPago.toFixed(1)}%)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Parcelas Pendentes</CardTitle>
                    <XCircle className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(parcelasData.resumo.valorPendente)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {parcelasData.resumo.parcelasPendentes} parcelas ({(100 - parcelasData.resumo.percentualPago).toFixed(1)}%)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Parcelas */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Detalhamento das Parcelas</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarCSV('parcelas')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Venda</TableHead>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Sócio</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data Pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelasData.parcelas.map((parcela) => (
                          <TableRow key={parcela.id}>
                            <TableCell className="font-medium">#{parcela.venda.numeroVenda}</TableCell>
                            <TableCell>{parcela.numeroParcela}</TableCell>
                            <TableCell>
                              {format(new Date(parcela.dataVencimento), 'MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>{parcela.venda.socio}</TableCell>
                            <TableCell>{parcela.venda.matricula || '-'}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(parcela.valor))}
                            </TableCell>
                            <TableCell>
                              {parcela.baixa === 'S' ? (
                                <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
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
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}

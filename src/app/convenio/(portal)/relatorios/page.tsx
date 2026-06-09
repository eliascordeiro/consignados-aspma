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
  FileText,
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
import { useMobile } from '@/hooks/useMobile'

interface VendasPeriodoData {
  periodo: { inicio: string; fim: string }
  resumo: {
    totalVendas: number
    valorTotal: number
    totalParcelas: number
    ticketMedio: number
    vendasAtivas: number
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
    descontoPorParcela: number
    totalDesconto: number
    valorLiquido: number
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
      quantidadeParcelas: number
      dataEmissao: string
      socio: string
      matricula: string | null
      cpf: string | null
    }
  }>
}

interface PosicaoFinanceiraData {
  resumo: {
    totalVendas: number
    totalSocios: number
    totalGeral: number
    totalPago: number
    totalPendente: number
    totalDesconto: number
    totalLiquido: number
    descontoPorParcela: number
  }
  socios: Array<{
    nome: string
    matricula: string | null
    cpf: string | null
    vendas: number
    totalVendas: number
    parcelasPagas: number
    parcelasPendentes: number
    valorPago: number
    valorPendente: number
    proximoVencimento: string | null
  }>
  vendas: Array<{
    id: string
    numeroVenda: number
    dataEmissao: string
    socio: string
    matricula: string | null
    cpf: string | null
    valorTotal: number
    quantidadeParcelas: number
    valorParcela: number
    parcelasPagas: number
    parcelasPendentes: number
    valorPago: number
    valorPendente: number
    proximoVencimento: string | null
  }>
}

export default function RelatoriosPage() {
  const [tipoRelatorio, setTipoRelatorio] = useState<'vendas' | 'parcelas' | 'posicao'>('vendas')
  const isMobile = useMobile()
  
  // Data mínima para filtros: 3 anos atrás
  const minDate = new Date(new Date().setFullYear(new Date().getFullYear() - 3)).toISOString().split('T')[0]
  const minMonth = minDate.substring(0, 7) // YYYY-MM

  // Estados para Vendas do Período
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [vendasData, setVendasData] = useState<VendasPeriodoData | null>(null)
  const [loadingVendas, setLoadingVendas] = useState(false)

  // Estados para Parcelas a Receber
  const [mesVencimento, setMesVencimento] = useState('')
  const [parcelasData, setParcelasData] = useState<ParcelasReceberData | null>(null)
  const [loadingParcelas, setLoadingParcelas] = useState(false)

  // Estados para Posição Financeira
  const [posicaoData, setPosicaoData] = useState<PosicaoFinanceiraData | null>(null)
  const [loadingPosicao, setLoadingPosicao] = useState(false)

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
    const bom = '\uFEFF'
    if (tipo === 'vendas' && vendasData) {
      const linhas = [
        ['Relatório de Vendas do Período', '', '', '', '', '', '', ''].join(';'),
        [`Período: ${dataInicio} a ${dataFim}`, '', '', '', '', '', '', ''].join(';'),
        [`Total de Vendas: ${vendasData.resumo.totalVendas}`, `Valor Total: R$ ${vendasData.resumo.valorTotal.toFixed(2).replace('.', ',')}`, '', '', '', '', '', ''].join(';'),
        ['', '', '', '', '', '', '', ''].join(';'),
        ['Nº Venda', 'Data', 'Sócio', 'Matrícula', 'Valor Total', 'Parcelas', 'Valor Parcela', 'Status'].join(';'),
        ...vendasData.vendas.map(v =>
          [
            v.numeroVenda,
            format(new Date(v.dataEmissao.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy'),
            `"${v.socio}"`,
            v.matricula || '',
            v.valorTotal.toFixed(2).replace('.', ','),
            v.quantidadeParcelas,
            v.valorParcela.toFixed(2).replace('.', ','),
            v.status === 'ativa' ? 'Ativa' : 'Cancelada',
          ].join(';')
        ),
      ]
      const csv = bom + linhas.join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `vendas_${dataInicio}_${dataFim}.csv`
      link.click()
    } else if (tipo === 'parcelas' && parcelasData) {
      const linhas = [
        ['Relatório de Parcelas a Receber', '', '', '', '', '', '', '', ''].join(';'),
        [`Mês: ${mesVencimento}`, '', '', '', '', '', '', '', ''].join(';'),
        [
          `Total: ${parcelasData.resumo.totalParcelas} parcelas`,
          `Bruto: R$ ${parcelasData.resumo.valorTotal.toFixed(2).replace('.', ',')}`,
          `Líquido: R$ ${parcelasData.resumo.valorLiquido.toFixed(2).replace('.', ',')}`,
          '', '', '', '', '', ''
        ].join(';'),
        ['', '', '', '', '', '', '', '', ''].join(';'),
        ['Nº Venda', 'Data Compra', 'Parcela', 'Vencimento', 'Valor Bruto', 'Sócio', 'Matrícula', 'CPF', 'Status'].join(';'),
        ...parcelasData.parcelas.map(p =>
          [
            p.venda.numeroVenda,
            format(new Date(p.venda.dataEmissao.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy'),
            `="${p.numeroParcela}/${p.venda.quantidadeParcelas}"`,
            format(new Date(p.dataVencimento), 'MM/yyyy'),
            Number(p.valor).toFixed(2).replace('.', ','),
            `"${p.venda.socio}"`,
            p.venda.matricula || '',
            p.venda.cpf || '',
            p.baixa === 'S' ? 'Paga' : 'Confirmada',
          ].join(';')
        ),
      ]
      const csv = bom + linhas.join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `parcelas_${mesVencimento}.csv`
      link.click()
    }
  }

  const gerarRelatorioPosicao = async () => {
    setLoadingPosicao(true)
    try {
      const response = await fetch('/api/convenio/relatorios/posicao-financeira')
      if (!response.ok) throw new Error('Erro ao gerar relatório')
      const data = await response.json()
      setPosicaoData(data)
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao gerar relatório de posição financeira')
    } finally {
      setLoadingPosicao(false)
    }
  }

  const exportarCSVPosicao = () => {
    if (!posicaoData) return
    const bom = '\uFEFF'
    const hoje = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    const linhas = [
      ['Relatório de Posição Financeira', '', '', '', '', '', '', ''].join(';'),
      [`Gerado em: ${hoje}`, '', '', '', '', '', '', ''].join(';'),
      [
        `Vendas Ativas: ${posicaoData.resumo.totalVendas}`,
        `Sócios: ${posicaoData.resumo.totalSocios}`,
        `A Receber (Bruto): R$ ${posicaoData.resumo.totalPendente.toFixed(2).replace('.', ',')}`,
        `Desconto: R$ ${posicaoData.resumo.totalDesconto.toFixed(2).replace('.', ',')}`,
        `A Receber (Líquido): R$ ${posicaoData.resumo.totalLiquido.toFixed(2).replace('.', ',')}`,
        '', '', ''
      ].join(';'),
      ['', '', '', '', '', '', '', ''].join(';'),
      ['Resumo por Sócio', '', '', '', '', '', '', ''].join(';'),
      ['Sócio', 'Matrícula', 'CPF', 'Nº Vendas', 'Parc. Pagas', 'Parc. Pendentes', 'Valor Pago', 'A Receber'].join(';'),
      ...posicaoData.socios.map(s =>
        [
          `"${s.nome}"`,
          s.matricula || '',
          s.cpf || '',
          s.vendas,
          s.parcelasPagas,
          s.parcelasPendentes,
          s.valorPago.toFixed(2).replace('.', ','),
          s.valorPendente.toFixed(2).replace('.', ','),
        ].join(';')
      ),
      ['', '', '', '', '', '', '', ''].join(';'),
      ['Detalhamento por Venda', '', '', '', '', '', '', ''].join(';'),
      ['Nº Venda', 'Sócio', 'Matrícula', 'Data Compra', 'Valor Total', 'Parc. Pagas', 'Parc. Pendentes', 'Próx. Vencimento'].join(';'),
      ...posicaoData.vendas.map(v =>
        [
          v.numeroVenda,
          `"${v.socio}"`,
          v.matricula || '',
          format(new Date(v.dataEmissao.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy'),
          v.valorTotal.toFixed(2).replace('.', ','),
          v.parcelasPagas,
          v.parcelasPendentes,
          v.proximoVencimento ? format(new Date(v.proximoVencimento), 'MM/yyyy') : '',
        ].join(';')
      ),
    ]
    const csv = bom + linhas.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `posicao_financeira_${format(new Date(), 'yyyyMMdd')}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Relatórios
        </h1>
        <p className="text-muted-foreground mt-1">
          Análises e relatórios gerenciais
        </p>
      </div>

      {/* Seleção de Tipo de Relatório */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione o Tipo de Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
            <Button
              variant={tipoRelatorio === 'posicao' ? 'default' : 'outline'}
              onClick={() => setTipoRelatorio('posicao')}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Posição Financeira
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
                    min={minDate}
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataFim">Data Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    min={minDate}
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
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Total de Vendas</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl sm:text-2xl font-bold">{vendasData.resumo.totalVendas}</div>
                    <p className="text-xs text-gray-500 mt-1">
                      {vendasData.resumo.totalParcelas} parcelas geradas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
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
              </div>

              {/* Status das Vendas */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle className="text-base sm:text-lg">Status das Vendas</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarCSV('vendas')}
                      className="w-full sm:w-auto"
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
                      <span className="text-sm text-muted-foreground">Ativas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{vendasData.resumo.vendasCanceladas}</Badge>
                      <span className="text-sm text-muted-foreground">Canceladas</span>
                    </div>
                  </div>

                  {/* Tabela de Vendas - Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {vendasData.vendas.map((venda) => (
                      <div key={venda.id} className="p-4 bg-muted rounded-lg border border-border">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-foreground">Venda #{venda.numeroVenda}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(venda.dataEmissao.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          </div>
                          {venda.status === 'cancelada' && (
                            <Badge variant="destructive" className="text-xs">Cancelada</Badge>
                          )}
                          {venda.status === 'ativa' && <Badge variant="default" className="text-xs">Ativa</Badge>}
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sócio:</span>
                            <span className="font-medium text-foreground text-right truncate ml-2">{venda.socio}</span>
                          </div>
                          {venda.matricula && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Matrícula:</span>
                              <span className="font-medium text-foreground">{venda.matricula}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Valor Total:</span>
                            <span className="font-bold text-foreground">{formatCurrency(Number(venda.valorTotal))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Parcelas:</span>
                            <span className="font-medium text-foreground">{venda.quantidadeParcelas}x de {formatCurrency(Number(venda.valorParcela))}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tabela de Vendas - Desktop */}
                  <div className="hidden md:block overflow-x-auto">
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
                              {format(new Date(venda.dataEmissao.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
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
                    min={minMonth}
                    value={mesVencimento}
                    onChange={(e) => setMesVencimento(e.target.value)}
                  />
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
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Total de Parcelas</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
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
                    <CardTitle className="text-sm font-medium">Valor Total a Receber</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Total Bruto</span>
                      <span className="text-sm font-medium">{formatCurrency(parcelasData.resumo.valorTotal)}</span>
                    </div>
                    {parcelasData.resumo.descontoPorParcela > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">Valor do Desconto</span>
                        <span className="text-sm font-medium text-red-500">{formatCurrency(parcelasData.resumo.totalDesconto)}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Total Líquido</span>
                      <span className="text-xl font-bold">{formatCurrency(parcelasData.resumo.valorLiquido)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Parcelas */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle className="text-base sm:text-lg">Detalhamento das Parcelas</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarCSV('parcelas')}
                      className="w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {parcelasData.parcelas.map((parcela) => (
                      <div key={parcela.id} className="p-4 bg-muted rounded-lg border border-border">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-foreground text-sm">
                              Venda #{parcela.venda.numeroVenda} — Parcela {parcela.numeroParcela}/{parcela.venda.quantidadeParcelas}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Compra: {format(new Date(parcela.venda.dataEmissao.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })} | Venc: {format(new Date(parcela.dataVencimento), 'MM/yyyy', { locale: ptBR })}
                            </div>
                          </div>
                          {parcela.baixa === 'S' ? (
                            <Badge variant="default" className="gap-1 text-xs bg-green-600 hover:bg-green-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Paga
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <XCircle className="h-3 w-3" />
                              Confirmada
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sócio:</span>
                            <span className="font-medium text-foreground text-right truncate ml-2">{parcela.venda.socio}</span>
                          </div>
                          {parcela.venda.matricula && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Matrícula:</span>
                              <span className="font-medium text-foreground">{parcela.venda.matricula}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-bold text-foreground">{formatCurrency(Number(parcela.valor))}</span>
                          </div>
                          {parcela.dataBaixa && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pago em:</span>
                              <span className="font-medium text-foreground">{format(new Date(parcela.dataBaixa), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Venda</TableHead>
                          <TableHead>Data Compra</TableHead>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Sócio</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parcelasData.parcelas.map((parcela) => (
                          <TableRow key={parcela.id}>
                            <TableCell className="font-medium">#{parcela.venda.numeroVenda}</TableCell>
                            <TableCell>
                              {format(new Date(parcela.venda.dataEmissao.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>{parcela.numeroParcela}/{parcela.venda.quantidadeParcelas}</TableCell>
                            <TableCell>
                              {format(new Date(parcela.dataVencimento), 'MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>{parcela.venda.socio}</TableCell>
                            <TableCell>{parcela.venda.matricula || '-'}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(parcela.valor))}
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

      {/* Posição Financeira */}
      {tipoRelatorio === 'posicao' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Posição Financeira</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Visão geral de todas as vendas ativas: parcelas pagas, pendentes e saldo a receber por sócio.
              </p>
              <Button onClick={gerarRelatorioPosicao} disabled={loadingPosicao} className="w-full sm:w-auto">
                {loadingPosicao ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" />Gerar Relatório</>
                )}
              </Button>
            </CardContent>
          </Card>

          {posicaoData && (
            <>
              {/* Cards de Resumo */}
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Vendas Ativas</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{posicaoData.resumo.totalVendas}</div>
                    <p className="text-xs text-muted-foreground mt-1">{posicaoData.resumo.totalSocios} sócio(s)</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">A Receber</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-xs text-muted-foreground">Bruto</div>
                    <div className="text-lg font-bold">{formatCurrency(posicaoData.resumo.totalPendente)}</div>
                    {posicaoData.resumo.descontoPorParcela > 0 && (
                      <>
                        <div className="text-xs text-muted-foreground pt-1 border-t">Líquido</div>
                        <div className="text-xl font-bold text-green-600">{formatCurrency(posicaoData.resumo.totalLiquido)}</div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Total Geral</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(posicaoData.resumo.totalGeral)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Soma de todas as vendas</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela por Sócio */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle className="text-base sm:text-lg">Resumo por Sócio</CardTitle>
                    <Button variant="outline" size="sm" onClick={exportarCSVPosicao} className="w-full sm:w-auto">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {posicaoData.socios.map((socio, i) => (
                      <div key={i} className="p-4 bg-muted rounded-lg border border-border">
                        <div className="font-semibold text-foreground">{socio.nome}</div>
                        {socio.matricula && <div className="text-xs text-muted-foreground">Mat: {socio.matricula}</div>}
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">A receber:</span>
                            <span className="font-bold text-foreground">{formatCurrency(socio.valorPendente)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Já pago:</span>
                            <span className="font-medium text-green-600">{formatCurrency(socio.valorPago)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Parc. pendentes:</span>
                            <span className="font-medium">{socio.parcelasPendentes}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sócio</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead className="text-center">Vendas</TableHead>
                          <TableHead className="text-center">Parc. Pagas</TableHead>
                          <TableHead className="text-center">Parc. Pendentes</TableHead>
                          <TableHead className="text-right">Já Recebido</TableHead>
                          <TableHead className="text-right">A Receber</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {posicaoData.socios.map((socio, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{socio.nome}</TableCell>
                            <TableCell>{socio.matricula || '-'}</TableCell>
                            <TableCell className="text-center">{socio.vendas}</TableCell>
                            <TableCell className="text-center">{socio.parcelasPagas}</TableCell>
                            <TableCell className="text-center">{socio.parcelasPendentes}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(socio.valorPago)}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(socio.valorPendente)}</TableCell>
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

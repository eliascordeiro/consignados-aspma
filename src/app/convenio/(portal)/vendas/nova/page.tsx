'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Search, User, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface Socio {
  id: string
  nome: string
  matricula: string | null
  cpf: string | null
  celular: string | null
  telefone: string | null
  margemConsig: number | null
  limite: number | null
  tipo: string | null
  empresaNome: string | null
}

interface MargemInfo {
  margem: number
  limite?: number
  descontos?: number
  fonte: string
  tipo: string | null
  mesReferencia?: string
  aviso?: string
  mensagem?: string
}

interface LimiteInfo {
  limiteTotal: number
  totalEmAberto: number
  limiteDisponivel: number
  tipo: string
  tipoDescricao: string
}

export default function NovaVendaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [socioSelecionado, setSocioSelecionado] = useState<Socio | null>(null)
  const [socios, setSocios] = useState<Socio[]>([])
  const [buscaMatriculaCelular, setBuscaMatriculaCelular] = useState('')
  const [buscandoPorMatricula, setBuscandoPorMatricula] = useState(false)
  const [margemInfo, setMargemInfo] = useState<MargemInfo | null>(null)
  const [consultandoMargem, setConsultandoMargem] = useState(false)
  const [limiteInfo, setLimiteInfo] = useState<LimiteInfo | null>(null)

  const [formData, setFormData] = useState({
    valorTotal: '',
    quantidadeParcelas: '',
    observacoes: '',
  })

  const valorParcela = formData.valorTotal && formData.quantidadeParcelas
    ? Number(formData.valorTotal) / Number(formData.quantidadeParcelas)
    : 0

  const buscarPorMatriculaCelular = async () => {
    const busca = buscaMatriculaCelular.trim()
    if (!busca) {
      alert('Digite uma matrícula ou celular')
      return
    }

    setBuscandoPorMatricula(true)
    setSocios([])
    setSocioSelecionado(null)
    setMargemInfo(null)

    try {
      const response = await fetch('/api/convenio/socios?busca=' + encodeURIComponent(busca))
      const data = await response.json()

      if (data.socios && data.socios.length > 0) {
        if (data.socios.length === 1) {
          await selecionarSocio(data.socios[0])
        } else {
          setSocios(data.socios)
        }
      } else {
        alert('Nenhum sócio encontrado com esta matrícula ou celular')
      }
    } catch (error) {
      console.error('Erro ao buscar sócio:', error)
      alert('Erro ao buscar sócio')
    } finally {
      setBuscandoPorMatricula(false)
    }
  }

  const selecionarSocio = async (socio: Socio) => {
    setSocioSelecionado(socio)
    setSocios([])
    await consultarLimiteDisponivel(socio.id)
    await consultarMargem(socio.id)
  }

  const consultarLimiteDisponivel = async (socioId: string) => {
    try {
      const response = await fetch(`/api/socios/${socioId}/limite-disponivel`)
      if (response.ok) {
        const data = await response.json()
        setLimiteInfo(data)
        console.log('✅ [Conv. Nova Venda] Limite disponível:', data)
      }
    } catch (error) {
      console.error('❌ [Conv. Nova Venda] Erro ao consultar limite:', error)
    }
  }

  const consultarMargem = async (socioId: string, vlParcela?: number) => {
    setConsultandoMargem(true)
    try {
      const vp = vlParcela || valorParcela || 0.1
      const response = await fetch('/api/convenio/socios/margem?socioId=' + socioId + '&valorParcela=' + vp)
      const data = await response.json()

      if (response.ok) {
        setMargemInfo({
          margem: data.margem,
          limite: data.limite,
          descontos: data.descontos,
          fonte: data.fonte,
          tipo: data.tipo,
          mesReferencia: data.mesReferencia,
          aviso: data.aviso,
          mensagem: data.mensagem,
        })
      } else {
        setMargemInfo(null)
      }
    } catch (error) {
      console.error('Erro ao consultar margem:', error)
      setMargemInfo(null)
    } finally {
      setConsultandoMargem(false)
    }
  }

  const trocarSocio = () => {
    setSocioSelecionado(null)
    setMargemInfo(null)
    setFormData({ valorTotal: '', quantidadeParcelas: '', observacoes: '' })
    setBuscaMatriculaCelular('')
    setSocios([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!socioSelecionado) {
      alert('Selecione um sócio')
      return
    }

    if (margemInfo && valorParcela > margemInfo.margem) {
      const confirmar = confirm(
        '⚠️ O valor da parcela (' + formatCurrency(valorParcela) + ') excede a margem consignável disponível (' + formatCurrency(margemInfo.margem) + ').\n\nDeseja continuar mesmo assim?'
      )
      if (!confirmar) return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/convenio/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: socioSelecionado.id,
          valorTotal: Number(formData.valorTotal),
          quantidadeParcelas: Number(formData.quantidadeParcelas),
          valorParcela: valorParcela,
          observacoes: formData.observacoes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar venda')
      }

      alert('Venda #' + data.venda.numeroVenda + ' criada com sucesso!')
      router.push('/convenio/vendas')
    } catch (error: any) {
      alert(error.message || 'Erro ao criar venda')
    } finally {
      setLoading(false)
    }
  }

  const fonteLabel = (fonte: string) => {
    switch (fonte) {
      case 'local': return 'Cálculo Local'
      case 'tempo_real': return 'ZETRA (Tempo Real)'
      case 'fallback': return 'Banco de Dados (Fallback)'
      case 'banco': return 'Banco de Dados'
      case 'zetra_erro': return 'ZETRA (Erro)'
      default: return fonte
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/convenio/vendas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Nova Venda
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre uma nova venda consignada
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Busca por Matrícula ou Celular */}
        {!socioSelecionado && (
          <Card>
            <CardHeader>
              <CardTitle>Buscar Sócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Matrícula ou Celular</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Digite a matrícula ou número do celular"
                      value={buscaMatriculaCelular}
                      onChange={(e) => setBuscaMatriculaCelular(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          buscarPorMatriculaCelular()
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={buscarPorMatriculaCelular}
                    disabled={buscandoPorMatricula}
                  >
                    {buscandoPorMatricula ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Lista de resultados */}
              {socios.length > 0 && (
                <div className="border border-border rounded-lg divide-y divide-border max-h-60 sm:max-h-80 overflow-y-auto">
                  {socios.map((socio) => (
                    <button
                      key={socio.id}
                      type="button"
                      onClick={() => selecionarSocio(socio)}
                      className="w-full p-3 text-left hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-foreground">
                        {socio.nome}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {socio.matricula && ('Mat: ' + socio.matricula)}
                        {socio.matricula && socio.celular && ' • '}
                        {socio.celular && ('Cel: ' + socio.celular)}
                        {!socio.celular && socio.cpf && (socio.matricula ? ' • ' : '')}
                        {!socio.celular && socio.cpf && ('CPF: ' + socio.cpf)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sócio Selecionado + Margem */}
        {socioSelecionado && (
          <Card>
            <CardHeader>
              <CardTitle>Sócio Selecionado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">
                        {socioSelecionado.nome}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
                        {socioSelecionado.matricula && (
                          <div>Matrícula: {socioSelecionado.matricula}</div>
                        )}
                        {socioSelecionado.cpf && (
                          <div>CPF: {socioSelecionado.cpf}</div>
                        )}
                        {socioSelecionado.celular && (
                          <div>Celular: {socioSelecionado.celular}</div>
                        )}
                        {socioSelecionado.empresaNome && (
                          <div>Empresa: {socioSelecionado.empresaNome}</div>
                        )}
                        {socioSelecionado.tipo && (
                          <div>Tipo: {socioSelecionado.tipo}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={trocarSocio}
                  >
                    Trocar
                  </Button>
                </div>
              </div>

              {/* Margem Consignável */}
              {consultandoMargem && (
                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-sm text-muted-foreground">
                    Consultando margem consignável...
                  </span>
                </div>
              )}

              {margemInfo && !consultandoMargem && (
                <div className={'p-4 rounded-lg border ' + (
                  margemInfo.margem > 0
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {margemInfo.margem > 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Margem Consignável — {fonteLabel(margemInfo.fonte)}
                    </span>
                  </div>

                  <div className={'text-2xl font-bold mb-1 ' + (
                    margemInfo.margem > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatCurrency(margemInfo.margem)}
                  </div>

                  {margemInfo.fonte === 'local' && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>Limite: {formatCurrency(margemInfo.limite || 0)}</div>
                      <div>Descontos do mês ({margemInfo.mesReferencia}): {formatCurrency(margemInfo.descontos || 0)}</div>
                    </div>
                  )}

                  {margemInfo.aviso && (
                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ {margemInfo.aviso}
                    </div>
                  )}

                  {margemInfo.mensagem && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      ❌ {margemInfo.mensagem}
                    </div>
                  )}
                </div>
              )}

              {/* Limite Disponível (Local) */}
              {limiteInfo && limiteInfo.tipoDescricao === 'Local' && (
                <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                      📊 Limite Disponível (Sistema Local)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
                    <div>
                      <div className="text-muted-foreground">Limite Total</div>
                      <div className="font-bold text-foreground text-sm sm:text-xs">{formatCurrency(limiteInfo.limiteTotal)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Em Aberto</div>
                      <div className="font-bold text-orange-600 dark:text-orange-400 text-sm sm:text-xs">{formatCurrency(limiteInfo.totalEmAberto)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Disponível</div>
                      <div className="font-bold text-green-600 dark:text-green-400 text-sm sm:text-xs">{formatCurrency(limiteInfo.limiteDisponivel)}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dados da Venda */}
        {socioSelecionado && (
          <Card>
            <CardHeader>
              <CardTitle>Dados da Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="valorTotal">Valor Total *</Label>
                  <Input
                    id="valorTotal"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formData.valorTotal}
                    onChange={(e) =>
                      setFormData({ ...formData, valorTotal: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantidadeParcelas">Nº de Parcelas *</Label>
                  <Input
                    id="quantidadeParcelas"
                    type="number"
                    min="1"
                    max="60"
                    placeholder="12"
                    value={formData.quantidadeParcelas}
                    onChange={(e) =>
                      setFormData({ ...formData, quantidadeParcelas: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorParcela">Valor da Parcela</Label>
                  <Input
                    id="valorParcela"
                    type="text"
                    value={valorParcela > 0 ? formatCurrency(valorParcela) : ''}
                    disabled
                    className="bg-gray-100 dark:bg-gray-800 font-semibold"
                  />
                </div>
              </div>

              {/* Comparação com margem */}
              {valorParcela > 0 && margemInfo && (
                <div className={'p-4 rounded-lg border ' + (
                  valorParcela <= margemInfo.margem
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                )}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Margem Disponível</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatCurrency(margemInfo.margem)}
                      </div>
                    </div>
                    <div className="sm:text-center">
                      <div className="text-sm text-muted-foreground">Valor Parcela</div>
                      <div className={'text-lg font-bold ' + (
                        valorParcela <= margemInfo.margem
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {formatCurrency(valorParcela)}
                      </div>
                    </div>
                    <div>
                      {valorParcela <= margemInfo.margem ? (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-sm font-medium">Aprovado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="text-sm font-medium">Excede</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {valorParcela > margemInfo.margem && (
                    <div className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
                      ⚠️ Valor da parcela excede a margem consignável disponível
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Informações adicionais sobre a venda..."
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botões */}
        {socioSelecionado && (
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando Venda...
                </>
              ) : (
                'Criar Venda'
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}

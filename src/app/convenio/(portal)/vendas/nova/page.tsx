'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Search, User, AlertTriangle, CheckCircle2, MessageSquare, ShieldCheck, Printer, ShoppingBag } from 'lucide-react'
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

interface VendaConfirmada {
  id: string
  numeroVenda: number
  valorTotal: number
  valorParcela: number
  quantidadeParcelas: number
  dataEmissao: string
  operador: string
  socio: { nome: string; matricula: string | null; cpf: string | null }
  convenio: { nome: string }
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

  const [vendaConfirmada, setVendaConfirmada] = useState<VendaConfirmada | null>(null)

  // Fluxo de verificação WhatsApp
  const [codigoEnviado, setCodigoEnviado] = useState(false)
  const [enviandoCodigo, setEnviandoCodigo] = useState(false)
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [validandoCodigo, setValidandoCodigo] = useState(false)
  const [celularEnviado, setCelularEnviado] = useState('')

  const [formData, setFormData] = useState({
    valorTotal: '',
    quantidadeParcelas: '',
    observacoes: '',
  })

  const valorParcela = formData.valorTotal && formData.quantidadeParcelas
    ? Number(formData.valorTotal) / Number(formData.quantidadeParcelas)
    : 0

  const buscarPorMatriculaCelular = async () => {
    const busca = buscaMatriculaCelular.trim().replace(/\D/g, '') // Apenas números
    if (!busca) {
      alert('Digite a matrícula ou CPF do sócio')
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
        alert('Nenhum sócio encontrado com esta matrícula ou CPF')
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
    // Resetar fluxo WhatsApp
    setCodigoEnviado(false)
    setCodigoDigitado('')
    setCelularEnviado('')
  }

  // PASSO 1: Enviar código via WhatsApp
  const enviarCodigoWhatsApp = async () => {
    if (!socioSelecionado) {
      alert('Selecione um sócio')
      return
    }

    if (!formData.valorTotal || !formData.quantidadeParcelas) {
      alert('Preencha o valor total e número de parcelas')
      return
    }

    if (margemInfo && valorParcela > margemInfo.margem) {
      alert('⚠️ O valor da parcela (' + formatCurrency(valorParcela) + ') excede a margem disponível (' + formatCurrency(margemInfo.margem) + ').\n\nAjuste os valores antes de enviar o código.')
      return
    }

    const celular = socioSelecionado.celular || socioSelecionado.telefone
    if (!celular) {
      alert('Este sócio não possui celular cadastrado. Não é possível enviar o código de verificação.')
      return
    }

    setEnviandoCodigo(true)

    try {
      const response = await fetch('/api/convenio/vendas/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: socioSelecionado.id,
          celular: celular,
          valorTotal: formData.valorTotal,
          quantidadeParcelas: formData.quantidadeParcelas,
          valorParcela: valorParcela,
          nomeSocio: socioSelecionado.nome,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar código')
      }

      setCodigoEnviado(true)
      setCelularEnviado(data.celularEnviado || celular)
      setCodigoDigitado('')
      alert('✅ Código enviado via WhatsApp para ' + (data.celularEnviado || celular))
    } catch (error: any) {
      alert(error.message || 'Erro ao enviar código via WhatsApp')
    } finally {
      setEnviandoCodigo(false)
    }
  }

  // PASSO 2: Validar código e criar venda
  const validarCodigoECriarVenda = async () => {
    if (!codigoDigitado.trim()) {
      alert('Digite o código recebido via WhatsApp')
      return
    }

    if (!socioSelecionado) return

    setValidandoCodigo(true)

    try {
      // Validar código
      const validarResponse = await fetch('/api/convenio/vendas/verificar-codigo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: socioSelecionado.id,
          codigo: codigoDigitado.trim(),
        }),
      })

      const validarData = await validarResponse.json()

      if (!validarResponse.ok) {
        throw new Error(validarData.error || 'Código inválido')
      }

      // Código válido - criar venda
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

      // Enviar notificação de confirmação
      try {
        await fetch('/api/convenio/vendas/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendaId: data.venda.id,
            socioId: socioSelecionado.id,
          }),
        })
        // Não bloqueia se notificação falhar
      } catch (notifError) {
        console.error('Erro ao enviar notificação:', notifError)
      }

      // Mostrar tela de sucesso com opção de imprimir
      setVendaConfirmada({
        id: data.venda.id,
        numeroVenda: data.venda.numeroVenda,
        valorTotal: Number(data.venda.valorTotal),
        valorParcela: Number(data.venda.valorParcela),
        quantidadeParcelas: data.venda.quantidadeParcelas,
        dataEmissao: data.venda.dataEmissao || new Date().toISOString(),
        operador: data.venda.operador || '',
        socio: data.socio || { nome: socioSelecionado.nome, matricula: socioSelecionado.matricula, cpf: socioSelecionado.cpf },
        convenio: data.convenio || { nome: '' },
      })
    } catch (error: any) {
      alert(error.message || 'Erro ao processar venda')
    } finally {
      setValidandoCodigo(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Formulário não faz submit direto — fluxo controlado pelos botões
  }

  const imprimirComprovante = (venda: VendaConfirmada) => {
    const formatMoeda = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const formatData = (iso: string) => {
      const d = new Date(iso)
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    const viaHtml = (via: string) => `
      <div class="via">
        <div class="center bold">${venda.convenio.nome || 'CONVÊNIO'}</div>
        <div class="center">COMPROVANTE DE VENDA</div>
        <div class="linha">================================</div>
        <div class="row"><span>Data:</span><span>${formatData(venda.dataEmissao)}</span></div>
        <div class="row"><span>Venda Nº:</span><span>${String(venda.numeroVenda).padStart(5, '0')}</span></div>
        <div class="row"><span>Operador:</span><span>${venda.operador || '-'}</span></div>
        <div class="linha">--------------------------------</div>
        <div class="label">ASSOCIADO:</div>
        <div class="bold">${venda.socio.nome}</div>
        ${venda.socio.matricula ? `<div class="row"><span>Matrícula:</span><span>${venda.socio.matricula}</span></div>` : ''}
        ${venda.socio.cpf ? `<div class="row"><span>CPF:</span><span>${venda.socio.cpf}</span></div>` : ''}
        <div class="linha">--------------------------------</div>
        <div class="row bold"><span>Valor Total:</span><span>${formatMoeda(venda.valorTotal)}</span></div>
        <div class="row"><span>Nº Parcelas:</span><span>${venda.quantidadeParcelas}x</span></div>
        <div class="row bold"><span>Valor Parcela:</span><span>${formatMoeda(venda.valorParcela)}</span></div>
        <div class="linha">================================</div>
        <div class="center small">Assinatura do Associado</div>
        <div class="assinatura">_______________________________</div>
        <div class="center bold via-label">${via}</div>
        <div class="linha">================================</div>
      </div>
    `

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Comprovante de Venda #${venda.numeroVenda}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            width: 80mm;
            margin: 0 auto;
            padding: 4px;
            color: #000;
          }
          .via { padding: 6px 0; page-break-inside: avoid; }
          .corte {
            margin: 4px 0;
            border: none;
            border-top: 2px dashed #000;
            text-align: center;
          }
          .corte-label {
            text-align: center;
            font-size: 9px;
            color: #555;
            margin-bottom: 6px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .small { font-size: 9px; }
          .linha { letter-spacing: 0; margin: 3px 0; overflow: hidden; white-space: nowrap; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .label { font-size: 9px; text-transform: uppercase; color: #555; margin-top: 3px; }
          .assinatura { text-align: center; margin: 8px auto; }
          .via-label { font-size: 10px; margin-top: 4px; }
          @media print {
            body { width: 80mm; }
            .corte { border-top: 2px dashed #000; }
          }
        </style>
      </head>
      <body>
        ${viaHtml('1ª Via - Convênio')}
        <hr class="corte">
        <div class="corte-label">✂ recortar aqui</div>
        ${viaHtml('2ª Via - Associado')}
        <script>window.onload = function(){ window.print(); }<\/script>
      </body>
      </html>
    `

    const janela = window.open('', '_blank', 'width=400,height=700')
    if (janela) {
      janela.document.write(html)
      janela.document.close()
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

  // Tela de sucesso após confirmar venda
  if (vendaConfirmada) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header sucesso */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Venda Confirmada
            </h1>
            <p className="text-muted-foreground mt-1">
              Venda registrada com sucesso
            </p>
          </div>
        </div>

        {/* Card de sucesso */}
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-6 space-y-5">
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-700 dark:text-green-400">
                  Venda #{String(vendaConfirmada.numeroVenda).padStart(5, '0')} criada!
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(vendaConfirmada.dataEmissao).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-lg border border-border divide-y divide-border text-sm">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">Associado</span>
                <span className="font-medium text-right max-w-[60%]">{vendaConfirmada.socio.nome}</span>
              </div>
              {vendaConfirmada.socio.matricula && (
                <div className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">Matrícula</span>
                  <span className="font-medium">{vendaConfirmada.socio.matricula}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">Valor Total</span>
                <span className="font-bold text-foreground">
                  {vendaConfirmada.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">Parcelas</span>
                <span className="font-medium">
                  {vendaConfirmada.quantidadeParcelas}x de{' '}
                  {vendaConfirmada.valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            {/* Botões */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => imprimirComprovante(vendaConfirmada)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Comprovante (2 vias)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setVendaConfirmada(null)
                  trocarSocio()
                }}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Nova Venda
              </Button>
            </div>

            <div className="text-center">
              <Link href="/convenio/vendas" className="text-sm text-muted-foreground hover:underline">
                Voltar para lista de vendas
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
        {/* Busca por Matrícula ou CPF */}
        {!socioSelecionado && (
          <Card>
            <CardHeader>
              <CardTitle>Buscar Sócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Matrícula ou CPF</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Digite a matrícula ou CPF (número exato)"
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
                      Margem Disponível:
                    </span>
                  </div>

                  <div className={'text-2xl font-bold ' + (
                    margemInfo.margem > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {formatCurrency(margemInfo.margem)}
                  </div>

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
            </CardContent>
          </Card>
        )}

        {/* Verificação WhatsApp e Confirmação */}
        {socioSelecionado && !codigoEnviado && (
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={enviandoCodigo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={enviarCodigoWhatsApp}
              disabled={enviandoCodigo || !formData.valorTotal || !formData.quantidadeParcelas || (margemInfo !== null && valorParcela > margemInfo.margem)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {enviandoCodigo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando código...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enviar Código WhatsApp
                </>
              )}
            </Button>
          </div>
        )}

        {/* Input do código + botão confirmar */}
        {socioSelecionado && codigoEnviado && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                Verificação WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-300">
                  📱 Código enviado para <strong>{celularEnviado}</strong>
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  O código é válido por 10 minutos.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigoVerificacao">Digite o código recebido</Label>
                <Input
                  id="codigoVerificacao"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={codigoDigitado}
                  onChange={(e) => setCodigoDigitado(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl font-bold tracking-[0.5em] max-w-[200px]"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCodigoEnviado(false)
                    setCodigoDigitado('')
                  }}
                  disabled={validandoCodigo}
                >
                  Reenviar Código
                </Button>
                <Button
                  type="button"
                  onClick={validarCodigoECriarVenda}
                  disabled={validandoCodigo || codigoDigitado.length < 6}
                  className="flex-1"
                >
                  {validandoCodigo ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmar Venda
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}

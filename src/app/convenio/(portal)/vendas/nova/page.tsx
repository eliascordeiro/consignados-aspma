'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Search, User } from 'lucide-react'
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

export default function NovaVendaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [buscaSocio, setBuscaSocio] = useState('')
  const [socioSelecionado, setSocioSelecionado] = useState<Socio | null>(null)
  const [socios, setSocios] = useState<Socio[]>([])
  const [buscandoSocios, setBuscandoSocios] = useState(false)
  const [buscaMatriculaCelular, setBuscaMatriculaCelular] = useState('')
  const [buscandoPorMatricula, setBuscandoPorMatricula] = useState(false)

  const [formData, setFormData] = useState({
    valorTotal: '',
    quantidadeParcelas: '',
    observacoes: '',
  })

  const buscarSocios = async (busca: string) => {
    if (busca.length < 2) {
      setSocios([])
      return
    }

    setBuscandoSocios(true)
    try {
      const response = await fetch(`/api/convenio/socios?busca=${encodeURIComponent(busca)}`)
      const data = await response.json()
      setSocios(data.socios || [])
    } catch (error) {
      console.error('Erro ao buscar sócios:', error)
    } finally {
      setBuscandoSocios(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      buscarSocios(buscaSocio)
    }, 300)

    return () => clearTimeout(timer)
  }, [buscaSocio])

  const selecionarSocio = (socio: Socio) => {
    setSocioSelecionado(socio)
    setBuscaSocio('')
    setSocios([])
    setBuscaMatriculaCelular('')
  }

  const buscarPorMatriculaCelular = async () => {
    if (!buscaMatriculaCelular.trim()) {
      alert('Digite uma matrícula ou celular')
      return
    }

    setBuscandoPorMatricula(true)
    try {
      const response = await fetch(`/api/convenio/socios?busca=${encodeURIComponent(buscaMatriculaCelular)}`)
      const data = await response.json()
      
      if (data.socios && data.socios.length > 0) {
        // Se encontrou apenas um, seleciona automaticamente
        if (data.socios.length === 1) {
          selecionarSocio(data.socios[0])
        } else {
          // Se encontrou mais de um, mostra a lista
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

  const valorParcela = formData.valorTotal && formData.quantidadeParcelas
    ? Number(formData.valorTotal) / Number(formData.quantidadeParcelas)
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!socioSelecionado) {
      alert('Selecione um sócio')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/convenio/vendas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      alert(`Venda #${data.venda.numeroVenda} criada com sucesso!`)
      router.push('/convenio/vendas')
    } catch (error: any) {
      alert(error.message || 'Erro ao criar venda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/convenio/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Nova Venda
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Cadastre uma nova venda consignada
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seleção de Sócio */}
        <Card>
          <CardHeader>
            <CardTitle>Selecione o Sócio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {socioSelecionado ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {socioSelecionado.nome}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                        {socioSelecionado.matricula && (
                          <div>Matrícula: {socioSelecionado.matricula}</div>
                        )}
                        {socioSelecionado.cpf && (
                          <div>CPF: {socioSelecionado.cpf}</div>
                        )}
                        {socioSelecionado.empresaNome && (
                          <div>Empresa: {socioSelecionado.empresaNome}</div>
                        )}
                        {socioSelecionado.margemConsig && (
                          <div className="font-medium text-green-600 dark:text-green-400">
                            Margem: {formatCurrency(Number(socioSelecionado.margemConsig))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSocioSelecionado(null)}
                  >
                    Trocar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome, matrícula ou CPF..."
                    value={buscaSocio}
                    onChange={(e) => setBuscaSocio(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {buscandoSocios && (
                  <div className="text-center py-4 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </div>
                )}

                {!buscandoSocios && socios.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
                    {socios.map((socio) => (
                      <button
                        key={socio.id}
                        type="button"
                        onClick={() => selecionarSocio(socio)}
                        className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {socio.nome}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {socio.matricula && `Mat: ${socio.matricula}`}
                          {socio.matricula && socio.cpf && ' • '}
                          {socio.cpf && `CPF: ${socio.cpf}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!buscandoSocios && buscaSocio.length >= 2 && socios.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    Nenhum sócio encontrado
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Busca Rápida por Matrícula/Celular */}
        {!socioSelecionado && (
          <Card>
            <CardHeader>
              <CardTitle>Busca Rápida</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Digite matrícula ou celular"
                    value={buscaMatriculaCelular}
                    onChange={(e) => setBuscaMatriculaCelular(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && buscarPorMatriculaCelular()}
                  />
                </div>
                <Button
                  type="button"
                  onClick={buscarPorMatriculaCelular}
                  disabled={buscandoPorMatricula}
                >
                  {buscandoPorMatricula ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
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
              <div className="grid gap-4 md:grid-cols-3">
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
                  <Label htmlFor="quantidadeParcelas">Número de Parcelas *</Label>
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
                    className="bg-gray-100 dark:bg-gray-800"
                  />
                </div>
              </div>

              {valorParcela > 0 && socioSelecionado.margemConsig && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-blue-800 dark:text-blue-400">
                        Margem Consignável Disponível
                      </div>
                      <div className="text-lg font-bold text-blue-900 dark:text-blue-300">
                        {formatCurrency(Number(socioSelecionado.margemConsig))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-blue-800 dark:text-blue-400">
                        Valor da Parcela
                      </div>
                      <div className={`text-lg font-bold ${
                        valorParcela <= Number(socioSelecionado.margemConsig)
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(valorParcela)}
                      </div>
                    </div>
                  </div>
                  {valorParcela > Number(socioSelecionado.margemConsig) && (
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
                  rows={4}
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

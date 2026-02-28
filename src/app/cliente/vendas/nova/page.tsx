'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Socio {
  id: string;
  nome: string;
  matricula: string;
  cpf: string;
  limite: number;
  margemConsig: number;
  numCompras: number;
  tipo?: string;
}

interface LimiteInfo {
  limiteTotal: number;
  totalEmAberto: number;
  limiteDisponivel: number;
  tipo: string;
  tipoDescricao: string;
}

interface Convenio {
  id: number;
  codigo: string | null;
  razao_soc: string;
  fantasia: string | null;
  nome: string;
}

interface Parcela {
  numeroParcela: number;
  dataVencimento: string;
  valor: number;
  baixa: string | null;
}

export default function NovaVendaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [searchSocio, setSearchSocio] = useState('');
  const [searchConvenio, setSearchConvenio] = useState('');
  const [showSocioList, setShowSocioList] = useState(false);
  const [showConvenioList, setShowConvenioList] = useState(false);

  const [formData, setFormData] = useState({
    socioId: '',
    socioNome: '',
    matricula: '',
    convenioId: '',
    convenioNome: '',
    convenioNumero: '',
    dataEmissao: new Date().toISOString().split('T')[0],
    quantidadeParcelas: 1,
    valorParcela: '',
    limite: 0,
  });

  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [socioSelecionado, setSocioSelecionado] = useState<Socio | null>(null);
  const [limiteInfo, setLimiteInfo] = useState<LimiteInfo | null>(null);
  const [consultandoLimite, setConsultandoLimite] = useState(false);
  const [buscandoLimiteParcela, setBuscandoLimiteParcela] = useState(false);

  // Formata valor para moeda brasileira (999.999.999,99)
  const formatarMoeda = (valor: number | string): string => {
    const num = typeof valor === 'string' ? parseFloat(valor) : valor;
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Remove formatação de moeda e retorna número
  const desformatarMoeda = (valorFormatado: string): string => {
    return valorFormatado.replace(/\./g, '').replace(',', '.');
  };

  // Busca sócios
  useEffect(() => {
    // Não busca se já tem sócio selecionado (evita reabrir lista após seleção)
    if (searchSocio.length >= 2 && !formData.socioId) {
      fetchSocios();
    } else if (searchSocio.length < 2) {
      setShowSocioList(false);
      setSocios([]);
    }
  }, [searchSocio]);

  // Busca convênios
  useEffect(() => {
    if (searchConvenio.length >= 2 && !formData.convenioId) {
      fetchConvenios();
    } else if (searchConvenio.length < 2) {
      setShowConvenioList(false);
    }
  }, [searchConvenio]);

  const fetchSocios = async () => {
    try {
      const response = await fetch(`/api/funcionarios?search=${searchSocio}`);
      if (response.ok) {
        const result = await response.json();
        // API retorna { data: [], pagination: {} }
        setSocios(result.data || result);
        setShowSocioList(true);
      }
    } catch (error) {
      console.error('Erro ao buscar sócios:', error);
    }
  };

  const fetchConvenios = async () => {
    try {
      const response = await fetch(`/api/convenios?search=${searchConvenio}`);
      if (response.ok) {
        const result = await response.json();
        // API retorna { data: [], pagination: {} }
        setConvenios(result.data || result);
        setShowConvenioList(true);
      }
    } catch (error) {
      console.error('Erro ao buscar convênios:', error);
    }
  };

  // Função para consultar limite disponível (AS200.PRG lógica: limite - total em aberto)
  const consultarLimiteDisponivel = async (socio: Socio) => {
    setConsultandoLimite(true);
    try {
      const response = await fetch(`/api/socios/${socio.id}/limite-disponivel`);
      if (response.ok) {
        const data = await response.json();
        setLimiteInfo(data);
        console.log('✅ [Nova Venda] Limite disponível:', data);
        return data;
      }
    } catch (error) {
      console.error('❌ [Nova Venda] Erro ao consultar limite disponível:', error);
    } finally {
      setConsultandoLimite(false);
    }
    return null;
  };

  // Função para consultar margem ZETRA (como AS200.PRG consulta_margem)
  const consultarMargemZetra = async (socio: Socio, valorParcela?: number) => {
    // Regra AS200.PRG: Se valorParcela > 0 usa ele, senão usa 0.1
    const valorParaConsulta = (valorParcela && valorParcela > 0) ? valorParcela : 0.1;
    
    console.log('🔍 [Nova Venda] Consultando margem ZETRA...', {
      socioId: socio.id,
      valorParcela: valorParaConsulta
    });

    try {
      const url = `/api/socios/${socio.id}/margem?valorParcela=${valorParaConsulta}`;
      const margemResponse = await fetch(url);
      
      if (margemResponse.ok) {
        const margemData = await margemResponse.json();
        console.log('✅ [Nova Venda] Margem recebida:', margemData);
        
        const margemValor = parseFloat(margemData.margem) || 0;
        
        // Regra AS200.PRG: Se margem <= 0, mostra erro do ZETRA
        if (margemValor <= 0 && margemData.mensagem) {
          alert(`⚠️ Consulta ZETRA\n\n${margemData.mensagem}\n\nSócio: ${socio.nome}\nMatrícula: ${socio.matricula}`);
          return 0;
        }
        
        // Atualiza limite (margem bruta do ZETRA)
        setFormData(prev => ({
          ...prev,
          limite: margemValor,
        }));

        // Log da margem sem alerta
        console.log(`✅ [Nova Venda] Margem obtida: R$ ${margemValor.toFixed(2)} - Fonte: ${margemData.fonte}`);
        
        // Alerta apenas se houver erro/aviso crítico
        if (margemData.fonte === 'fallback') {
          console.warn(`⚠️ ${margemData.aviso}`);
        }
        
        return margemValor;
      }
    } catch (error) {
      console.error('❌ [Nova Venda] Erro ao buscar margem:', error);
      alert(`❌ Erro ao consultar margem\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return 0;
    }
  };

  const selecionarSocio = async (socio: Socio) => {
    setFormData({
      ...formData,
      socioId: socio.id,
      socioNome: socio.nome,
      matricula: socio.matricula || '',
      limite: parseFloat(socio.limite?.toString() || '0'),
    });
    setSearchSocio(socio.nome);
    setShowSocioList(false);
    setSocios([]);
    setSocioSelecionado(socio); // Guarda referência para reconsultar

    // Ativa spinner no campo "Limite por Parcela"
    setBuscandoLimiteParcela(true);
    try {
      // Consulta limite disponível (local)
      await consultarLimiteDisponivel(socio);

      // Consulta margem ZETRA (se aplicável)
      await consultarMargemZetra(socio);
    } finally {
      setBuscandoLimiteParcela(false);
    }
  };

  const selecionarConvenio = (convenio: Convenio) => {
    setFormData({
      ...formData,
      convenioId: convenio.id.toString(),
      convenioNome: convenio.razao_soc,
      convenioNumero: convenio.codigo || '',
    });
    setSearchConvenio(convenio.razao_soc);
    setShowConvenioList(false);
    setConvenios([]);
  };

  // Valida se valor da parcela excede margem disponível (sem reconsultar)
  const validarValorParcela = (valor: string) => {
    const valorNum = parseFloat(valor);
    const margemAtual = formData.limite || 0;
    
    if (valorNum > margemAtual) {
      alert(
        `❌ VALOR BLOQUEADO!\n\n` +
        `Valor da Parcela: R$ ${valorNum.toFixed(2)}\n` +
        `Margem Disponível: R$ ${margemAtual.toFixed(2)}\n\n` +
        `Digite um valor menor ou igual à margem disponível.`
      );
      // Limpa o valor da parcela
      setFormData({ ...formData, valorParcela: '' });
      return false;
    }
    return true;
  };

  const gerarParcelas = () => {
    if (!formData.quantidadeParcelas || !formData.valorParcela || !formData.dataEmissao) {
      return;
    }

    const quantidade = parseInt(formData.quantidadeParcelas.toString());
    
    // Converte valor formatado (1.200,33) para número (1200.33)
    const valorLimpo = formData.valorParcela.toString().replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(valorLimpo);
    
    if (isNaN(valor)) {
      alert('Valor da parcela inválido');
      return;
    }
    
    const dataBase = new Date(formData.dataEmissao);

    // Se a data de emissão for depois do dia 9, começa no próximo mês
    const diaEmissao = dataBase.getDate();
    let mesInicial = dataBase.getMonth();
    let anoInicial = dataBase.getFullYear();

    if (diaEmissao > 9) {
      mesInicial++;
      if (mesInicial > 11) {
        mesInicial = 0;
        anoInicial++;
      }
    }

    const novasParcelas: Parcela[] = [];
    for (let i = 0; i < quantidade; i++) {
      const mes = (mesInicial + i) % 12;
      const ano = anoInicial + Math.floor((mesInicial + i) / 12);
      
      // Sempre vence no dia 1 do mês
      const dataVencimento = new Date(ano, mes, 1);
      
      novasParcelas.push({
        numeroParcela: i + 1,
        dataVencimento: dataVencimento.toISOString().split('T')[0],
        valor,
        baixa: null,
      });
    }

    setParcelas(novasParcelas);
  };

  const atualizarParcela = (index: number, campo: string, valor: any) => {
    const novasParcelas = [...parcelas];
    novasParcelas[index] = {
      ...novasParcelas[index],
      [campo]: valor,
    };
    setParcelas(novasParcelas);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.socioId) {
      alert('Selecione um sócio/associado');
      return;
    }

    if (!formData.convenioId) {
      alert('Selecione um convênio');
      return;
    }

    if (parcelas.length === 0) {
      alert('Gere as parcelas antes de salvar');
      return;
    }

    // REGRA CRÍTICA 1: Bloqueia se valor da PARCELA > margem disponível
    const valorParcela = parseFloat(formData.valorParcela || '0');
    const margemAtual = formData.limite || 0;
    
    if (valorParcela > margemAtual) {
      alert(
        `❌ BLOQUEADO! Valor da parcela excede a margem.\n\n` +
        `Valor da Parcela: R$ ${valorParcela.toFixed(2)}\n` +
        `Margem Disponível: R$ ${margemAtual.toFixed(2)}\n\n` +
        `Corrija o valor da parcela antes de continuar.`
      );
      return;
    }

    // REGRA CRÍTICA 2: Bloqueia se valor TOTAL > margem disponível
    const valorTotal = parcelas.reduce((sum, p) => sum + p.valor, 0);
    
    if (valorTotal > margemAtual) {
      alert(
        `❌ BLOQUEADO! Valor total excede a margem.\n\n` +
        `Valor Total: R$ ${valorTotal.toFixed(2)}\n` +
        `Margem Disponível: R$ ${margemAtual.toFixed(2)}\n` +
        `Excedente: R$ ${(valorTotal - margemAtual).toFixed(2)}\n\n` +
        `Reduza o valor da parcela ou a quantidade de parcelas.`
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: formData.socioId,
          convenioId: parseInt(formData.convenioId),
          dataEmissao: formData.dataEmissao,
          parcelas: parcelas,
        }),
      });

      if (response.ok) {
        alert('Venda cadastrada com sucesso!');
        router.push('/cliente/vendas');
      } else {
        const error = await response.json();
        alert(`Erro ao cadastrar venda: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao cadastrar venda:', error);
      alert('Erro ao cadastrar venda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    setFormData({
      socioId: '',
      socioNome: '',
      matricula: '',
      convenioId: '',
      convenioNome: '',
      convenioNumero: '',
      dataEmissao: new Date().toISOString().split('T')[0],
      quantidadeParcelas: 1,
      valorParcela: '',
      limite: 0,
    });
    setSearchSocio('');
    setSearchConvenio('');
    setParcelas([]);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lançamento de Vendas</h1>
        <Link
          href="/cliente/vendas"
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
        >
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-card text-card-foreground p-6 rounded-lg shadow-md space-y-6">
        {/* Sócio/Associado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Nome do Associado *</label>
            <input
              type="text"
              value={searchSocio}
              onChange={(e) => {
                setSearchSocio(e.target.value);
                if (!e.target.value) {
                  setFormData({ ...formData, socioId: '', socioNome: '', matricula: '', limite: 0 });
                }
              }}
              placeholder="Digite matrícula, nome ou CPF"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {showSocioList && socios.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                {socios.map((socio) => (
                  <div
                    key={socio.id}
                    onClick={() => selecionarSocio(socio)}
                    className="p-3 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600"
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">{socio.nome}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {socio.matricula && <span>Mat: {socio.matricula}</span>}
                      {socio.cpf && socio.matricula && <span> | </span>}
                      {socio.cpf && <span>CPF: {socio.cpf}</span>}
                      {(socio.matricula || socio.cpf) && <span> | </span>}
                      <span>Limite: R$ {parseFloat(socio.limite?.toString() || '0').toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Matrícula</label>
            <input
              type="text"
              value={formData.matricula}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Convênio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Convênio *</label>
            <input
              type="text"
              value={searchConvenio}
              onChange={(e) => {
                setSearchConvenio(e.target.value);
                if (!e.target.value) {
                  setFormData({ ...formData, convenioId: '', convenioNome: '', convenioNumero: '' });
                }
              }}
              placeholder="Digite código, razão social ou nome fantasia"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {showConvenioList && convenios.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                {convenios.map((convenio) => (
                  <div
                    key={convenio.id}
                    onClick={() => selecionarConvenio(convenio)}
                    className="p-3 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600"
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">{convenio.razao_soc}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {convenio.fantasia && <span>Fantasia: {convenio.fantasia} | </span>}
                      {convenio.codigo && <span>Código: {convenio.codigo}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Código</label>
            <input
              type="text"
              value={formData.convenioNumero}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Informações de Limite Disponível */}
        {limiteInfo && limiteInfo.tipoDescricao === 'Local' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">📊 Informações de Limite (Sistema Local)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Limite Total:</span>
                <p className="font-bold text-gray-900 dark:text-white">R$ {limiteInfo.limiteTotal.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Total em Aberto:</span>
                <p className="font-bold text-orange-600 dark:text-orange-400">R$ {limiteInfo.totalEmAberto.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Limite Disponível:</span>
                <p className="font-bold text-green-600 dark:text-green-400">R$ {limiteInfo.limiteDisponivel.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Limite, Data, Parcelas e Valor */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Limite por Parcela</label>
            <div className="relative">
              <input
                type="text"
                value={buscandoLimiteParcela ? 'Consultando...' : `R$ ${formData.limite.toFixed(2)}`}
                readOnly
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 font-bold ${
                  buscandoLimiteParcela ? 'text-gray-400 dark:text-gray-500' : 'text-blue-600 dark:text-blue-400'
                }`}
              />
              {buscandoLimiteParcela && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Data de Emissão *</label>
            <input
              type="date"
              value={formData.dataEmissao}
              onChange={(e) => setFormData({ ...formData, dataEmissao: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Nº de Parcelas *</label>
            <input
              type="number"
              min="1"
              max="99"
              value={formData.quantidadeParcelas}
              onChange={(e) => setFormData({ ...formData, quantidadeParcelas: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Valor da Parcela *</label>
            <input
              type="text"
              value={formData.valorParcela}
              onChange={(e) => {
                const valor = e.target.value;
                // Permite apenas números, vírgula e ponto
                // Aceita: 123, 123,45, 1234,56, etc
                const valorLimpo = valor.replace(/[^\d,\.]/g, '');
                setFormData({ ...formData, valorParcela: valorLimpo });
              }}
              onBlur={(e) => {
                const valorDigitado = e.target.value;
                if (!valorDigitado) return;
                
                // Converte para formato numérico (troca vírgula por ponto)
                const valorNumerico = valorDigitado.replace(/\./g, '').replace(',', '.');
                const valorNum = parseFloat(valorNumerico);
                
                if (isNaN(valorNum)) {
                  setFormData({ ...formData, valorParcela: '' });
                  return;
                }
                
                // Formata para moeda brasileira ao sair do campo
                const valorFormatado = valorNum.toLocaleString('pt-BR', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                });
                setFormData({ ...formData, valorParcela: valorFormatado });
                
                // Valida se valor não excede margem
                const valorValido = validarValorParcela(valorNumerico);
                if (valorValido) {
                  gerarParcelas();
                }
              }}
              onFocus={(e) => {
                // Remove formatação ao focar para facilitar edição
                const valorAtual = e.target.value;
                if (valorAtual) {
                  const valorNumerico = valorAtual.replace(/\./g, '').replace(',', '.');
                  const valorNum = parseFloat(valorNumerico);
                  if (!isNaN(valorNum)) {
                    setFormData({ ...formData, valorParcela: valorNum.toString().replace('.', ',') });
                  }
                }
              }}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Botão Gerar Vencimentos */}
        <div>
          <button
            type="button"
            onClick={gerarParcelas}
            className="w-full md:w-auto px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-semibold"
          >
            Gerar Vencimentos
          </button>
        </div>

        {/* Tabela de Parcelas */}
        {parcelas.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Parcelas Geradas</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-card text-card-foreground border border-gray-300 dark:border-gray-600">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-left text-gray-900 dark:text-white">#</th>
                    <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-left text-gray-900 dark:text-white">Vencimento (Mês/Ano)</th>
                    <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((parcela, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">{parcela.numeroParcela}</td>
                      <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
                        <input
                          type="text"
                          value={new Date(parcela.dataVencimento).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
                        />
                      </td>
                      <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right">
                        <input
                          type="text"
                          value={formatarMoeda(parcela.valor)}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">TOTAL:</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">
                      R$ {formatarMoeda(parcelas.reduce((sum, p) => sum + p.valor, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-4 justify-end mt-6">
          <button
            type="button"
            onClick={limparFormulario}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
          >
            Limpar
          </button>
          <button
            type="submit"
            disabled={loading || parcelas.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Salvar Venda'}
          </button>
        </div>
      </form>
    </div>
  );
}

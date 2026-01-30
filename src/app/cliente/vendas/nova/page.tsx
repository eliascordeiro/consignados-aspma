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

  // Busca sócios
  useEffect(() => {
    if (searchSocio.length >= 2 && !formData.socioId) {
      fetchSocios();
    } else if (searchSocio.length < 2) {
      setShowSocioList(false);
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

        // Exibe informação conforme fonte
        if (margemData.fonte === 'tempo_real') {
          alert(`✅ Margem ZETRA atualizada\n\nValor: R$ ${margemValor.toFixed(2)}\n\nSócio: ${socio.nome}\nMatrícula: ${socio.matricula}\nValor consultado: R$ ${valorParaConsulta.toFixed(2)}`);
        } else if (margemData.fonte === 'fallback') {
          alert(`⚠️ ${margemData.aviso}\n\nValor: R$ ${margemValor.toFixed(2)}`);
        } else {
          alert(`📦 Margem do banco de dados\n\nValor: R$ ${margemValor.toFixed(2)}`);
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

    // Consulta margem inicial (sem valor de parcela ainda)
    await consultarMargemZetra(socio);
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
    

  // Regra AS200.PRG: Quando usuário digita valor da parcela, reconsulta margem
  const handleValorParcelaChange = async (novoValor: string) => {
    setFormData({ ...formData, valorParcela: novoValor });
    
    // Se tem sócio selecionado e valor > 0, reconsulta
    const valorNum = parseFloat(novoValor);
    if (socioSelecionado && valorNum > 0) {
      await consultarMargemZetra(socioSelecionado, valorNum);
    }
  };setConvenios([]);
  };

  const gerarParcelas = () => {
    if (!formData.quantidadeParcelas || !formData.valorParcela || !formData.dataEmissao) {
      return;
    }

    const quantidade = parseInt(formData.quantidadeParcelas.toString());
    const valor = parseFloat(formData.valorParcela);
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

    // Verifica se o valor total não ultrapassa o limite
    const valorTotal = parcelas.reduce((sum, p) => sum + p.valor, 0);
    if (formData.limite > 0 && formData.valorParcela && parseFloat(formData.valorParcela) > formData.limite) {
      const confirma = confirm(
        `Atenção: O valor da parcela (R$ ${parseFloat(formData.valorParcela).toFixed(2)}) ` +
        `ultrapassa o limite disponível (R$ ${formData.limite.toFixed(2)}). Deseja continuar?`
      );
      if (!confirma) return;
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
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
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
            <label className="block text-sm font-bold mb-2">Convênio *</label>
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

        {/* Limite, Data, Parcelas e Valor */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Limite por Parcela</label>
            <input
              type="text"
              value={`R$ ${formData.limite.toFixed(2)}`}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 font-bold text-blue-600 dark:text-blue-400"
            />
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
              required(e) => {
                gerarParcelas();
                // Regra AS200.PRG: Consulta margem quando sai do campo
                const valor = parseFloat(e.target.value);
                if (socioSelecionado && valor > 0) {
                  handleValorParcelaChange(e.target.value);
                }
              }
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Valor da Parcela *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.valorParcela}
              onChange={(e) => setFormData({ ...formData, valorParcela: e.target.value })}
              onBlur={gerarParcelas}
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
              <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-left text-gray-900 dark:text-white">#</th>
                    <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-left text-gray-900 dark:text-white">Vencimento</th>
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
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={parcela.valor}
                          onChange={(e) => atualizarParcela(index, 'valor', parseFloat(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">TOTAL:</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">
                      R$ {parcelas.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}
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
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Limpar
          </button>
          <button
            type="submit"
            disabled={loading || parcelas.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Salvar Venda'}
          </button>
        </div>
      </form>
    </div>
  );
}

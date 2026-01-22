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
  razao_soc: string;
  codigo: string;
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
    dataEmissao: new Date().toISOString().split('T')[0],
    operador: '',
    observacoes: '',
    quantidadeParcelas: 1,
    valorParcela: '',
    limite: 0,
  });

  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  // Busca sócios
  useEffect(() => {
    if (searchSocio.length >= 2) {
      fetchSocios();
    }
  }, [searchSocio]);

  // Busca convênios
  useEffect(() => {
    if (searchConvenio.length >= 2) {
      fetchConvenios();
    }
  }, [searchConvenio]);

  const fetchSocios = async () => {
    try {
      const response = await fetch(`/api/socios?search=${searchSocio}&ativo=true`);
      if (response.ok) {
        const data = await response.json();
        setSocios(data);
        setShowSocioList(true);
      }
    } catch (error) {
      console.error('Erro ao buscar sócios:', error);
    }
  };

  const fetchConvenios = async () => {
    try {
      const response = await fetch(`/api/convenio?search=${searchConvenio}&ativo=true`);
      if (response.ok) {
        const data = await response.json();
        setConvenios(data);
        setShowConvenioList(true);
      }
    } catch (error) {
      console.error('Erro ao buscar convênios:', error);
    }
  };

  const selecionarSocio = (socio: Socio) => {
    setFormData({
      ...formData,
      socioId: socio.id,
      socioNome: socio.nome,
      matricula: socio.matricula || '',
      limite: parseFloat(socio.limite?.toString() || '0'),
    });
    setSearchSocio(socio.nome);
    setShowSocioList(false);
  };

  const selecionarConvenio = (convenio: Convenio) => {
    setFormData({
      ...formData,
      convenioId: convenio.id.toString(),
      convenioNome: convenio.razao_soc,
    });
    setSearchConvenio(convenio.razao_soc);
    setShowConvenioList(false);
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
          operador: formData.operador,
          observacoes: formData.observacoes,
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
      dataEmissao: new Date().toISOString().split('T')[0],
      operador: '',
      observacoes: '',
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
        <h1 className="text-2xl font-bold">Lançamento de Vendas</h1>
        <Link
          href="/cliente/vendas"
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
        {/* Sócio/Associado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-sm font-bold mb-2">Matrícula/Associado *</label>
            <input
              type="text"
              value={searchSocio}
              onChange={(e) => {
                setSearchSocio(e.target.value);
                if (!e.target.value) {
                  setFormData({ ...formData, socioId: '', socioNome: '', matricula: '', limite: 0 });
                }
              }}
              placeholder="Digite o nome para pesquisar"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {showSocioList && socios.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                {socios.map((socio) => (
                  <div
                    key={socio.id}
                    onClick={() => selecionarSocio(socio)}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b"
                  >
                    <div className="font-semibold">{socio.nome}</div>
                    <div className="text-sm text-gray-600">
                      Matrícula: {socio.matricula} | Limite: R$ {parseFloat(socio.limite?.toString() || '0').toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Associado</label>
            <input
              type="text"
              value={formData.socioNome}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Limite por Parcela</label>
            <input
              type="text"
              value={`R$ ${formData.limite.toFixed(2)}`}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-100 font-bold text-blue-600"
            />
          </div>
        </div>

        {/* Convênio */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-bold mb-2">Convênio *</label>
            <input
              type="text"
              value={searchConvenio}
              onChange={(e) => {
                setSearchConvenio(e.target.value);
                if (!e.target.value) {
                  setFormData({ ...formData, convenioId: '', convenioNome: '' });
                }
              }}
              placeholder="Digite para pesquisar convênio"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {showConvenioList && convenios.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                {convenios.map((convenio) => (
                  <div
                    key={convenio.id}
                    onClick={() => selecionarConvenio(convenio)}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b"
                  >
                    <div className="font-semibold">{convenio.razao_soc}</div>
                    <div className="text-sm text-gray-600">Código: {convenio.codigo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Razão Social</label>
            <input
              type="text"
              value={formData.convenioNome}
              readOnly
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>
        </div>

        {/* Operador e Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">Operador</label>
            <input
              type="text"
              value={formData.operador}
              onChange={(e) => setFormData({ ...formData, operador: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Data de Emissão *</label>
            <input
              type="date"
              value={formData.dataEmissao}
              onChange={(e) => setFormData({ ...formData, dataEmissao: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Observações</label>
            <input
              type="text"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Parcelas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">Nº de Parcelas *</label>
            <input
              type="number"
              min="1"
              max="99"
              value={formData.quantidadeParcelas}
              onChange={(e) => setFormData({ ...formData, quantidadeParcelas: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Valor da Parcela *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.valorParcela}
              onChange={(e) => setFormData({ ...formData, valorParcela: e.target.value })}
              onBlur={gerarParcelas}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={gerarParcelas}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Gerar Vencimentos
            </button>
          </div>
        </div>

        {/* Tabela de Parcelas */}
        {parcelas.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-3">Parcelas Geradas</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border text-left">#</th>
                    <th className="px-4 py-2 border text-left">Vencimento</th>
                    <th className="px-4 py-2 border text-right">Valor</th>
                    <th className="px-4 py-2 border text-center">Baixa</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((parcela, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">{parcela.numeroParcela}</td>
                      <td className="px-4 py-2 border">
                        <input
                          type="text"
                          value={new Date(parcela.dataVencimento).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                          readOnly
                          className="w-full px-2 py-1 border rounded bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-2 border text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={parcela.valor}
                          onChange={(e) => atualizarParcela(index, 'valor', parseFloat(e.target.value))}
                          className="w-full px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="px-4 py-2 border text-center">
                        <input
                          type="text"
                          maxLength={1}
                          value={parcela.baixa || ''}
                          onChange={(e) => atualizarParcela(index, 'baixa', e.target.value.toUpperCase() || null)}
                          className="w-12 px-2 py-1 border rounded text-center uppercase"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 border text-right">TOTAL:</td>
                    <td className="px-4 py-2 border text-right">
                      R$ {parcelas.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 border"></td>
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

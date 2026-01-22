'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Venda {
  id: string;
  numeroVenda: number;
  dataEmissao: string;
  quantidadeParcelas: number;
  valorParcela: number;
  valorTotal: number;
  operador: string;
  observacoes: string;
  ativo: boolean;
  cancelado: boolean;
  socio: {
    id: string;
    nome: string;
    matricula: string;
  };
  convenio: {
    id: number;
    razao_soc: string;
  };
  parcelas: any[];
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAtivo, setFiltroAtivo] = useState('true');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchVendas();
  }, [filtroAtivo]);

  const fetchVendas = async () => {
    try {
      setLoading(true);
      const url = filtroAtivo
        ? `/api/vendas?ativo=${filtroAtivo}`
        : '/api/vendas';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setVendas(data);
      }
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
    } finally {
      setLoading(false);
    }
  };

  const excluirVenda = async (id: string, numeroVenda: number, socioNome: string) => {
    const confirma = confirm(
      `Deseja realmente cancelar a venda #${numeroVenda} de ${socioNome}?`
    );

    if (!confirma) return;

    try {
      const response = await fetch(`/api/vendas/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Venda cancelada com sucesso!');
        fetchVendas();
      } else {
        const error = await response.json();
        alert(`Erro ao cancelar venda: ${error.error}`);
      }
    } catch (error) {
      console.error('Erro ao cancelar venda:', error);
      alert('Erro ao cancelar venda. Tente novamente.');
    }
  };

  const vendasFiltradas = vendas.filter((venda) => {
    if (!searchTerm) return true;
    
    const termo = searchTerm.toLowerCase();
    return (
      venda.numeroVenda.toString().includes(termo) ||
      venda.socio.nome.toLowerCase().includes(termo) ||
      venda.socio.matricula?.toLowerCase().includes(termo) ||
      venda.convenio?.razao_soc?.toLowerCase().includes(termo)
    );
  });

  const parcelasPagas = (parcelas: any[]) => {
    return parcelas.filter((p) => p.baixa).length;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendas</h1>
        <Link
          href="/cliente/vendas/nova"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          + Nova Venda
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Pesquisar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Número, sócio, matrícula ou convênio..."
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Vendas */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando vendas...</p>
        </div>
      ) : vendasFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-md text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {searchTerm
              ? 'Nenhuma venda encontrada com os filtros aplicados.'
              : 'Nenhuma venda cadastrada.'}
          </p>
          <Link
            href="/cliente/vendas/nova"
            className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Cadastrar primeira venda
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Venda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sócio/Matrícula
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Convênio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Emissão
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parcelas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {vendasFiltradas.map((venda) => (
                  <tr key={venda.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        #{venda.numeroVenda}
                      </div>
                      {venda.operador && (
                        <div className="text-xs text-gray-500">
                          Op: {venda.operador}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {venda.socio.nome}
                      </div>
                      <div className="text-xs text-gray-500">
                        Mat: {venda.socio.matricula || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {venda.convenio?.razao_soc || 'Sem convênio'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(new Date(venda.dataEmissao), 'dd/MM/yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {parcelasPagas(venda.parcelas)}/{venda.quantidadeParcelas}
                      </div>
                      <div className="text-xs text-gray-500">
                        R$ {parseFloat(venda.valorParcela.toString()).toFixed(2)}/parc
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        R$ {parseFloat(venda.valorTotal.toString()).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {venda.cancelado ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Cancelado
                        </span>
                      ) : venda.ativo ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/cliente/vendas/${venda.id}`}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver detalhes"
                        >
                          👁️
                        </Link>
                        {venda.ativo && !venda.cancelado && (
                          <button
                            onClick={() =>
                              excluirVenda(venda.id, venda.numeroVenda, venda.socio.nome)
                            }
                            className="text-red-600 hover:text-red-900"
                            title="Cancelar venda"
                          >
                            ❌
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumo */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total de vendas: <strong>{vendasFiltradas.length}</strong>
              </div>
              <div className="text-sm text-gray-600">
                Valor total: <strong>
                  R$ {vendasFiltradas
                    .reduce((sum, v) => sum + parseFloat(v.valorTotal.toString()), 0)
                    .toFixed(2)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

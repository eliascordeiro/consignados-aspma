'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';

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
  } | null;
  parcelas: Array<{
    id: string;
    numeroParcela: number;
    baixa: string | null;
  }>;
}

interface VendasResponse {
  data: Venda[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function fetchVendas({
  pageParam = null,
  filtroAtivo,
  searchTerm,
}: {
  pageParam?: string | null;
  filtroAtivo: string;
  searchTerm: string;
}): Promise<VendasResponse> {
  const params = new URLSearchParams();
  
  if (pageParam) {
    params.set('cursor', pageParam);
  }
  
  if (filtroAtivo) {
    params.set('ativo', filtroAtivo);
  }
  
  if (searchTerm) {
    params.set('search', searchTerm);
  }
  
  params.set('limit', '50');

  const response = await fetch(`/api/vendas?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Erro ao carregar vendas');
  }
  
  return response.json();
}

export default function VendasPage() {
  const [filtroAtivo, setFiltroAtivo] = useState('true');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Check mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['vendas', filtroAtivo, searchTerm],
    queryFn: ({ pageParam }) =>
      fetchVendas({ pageParam, filtroAtivo, searchTerm }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
  });

  const allVendas = data?.pages.flatMap((page) => page.data) ?? [];

  const excluirVenda = async (
    id: string,
    numeroVenda: number,
    socioNome: string
  ) => {
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
        refetch();
      } else {
        const error = await response.json();
        alert(`Erro ao cancelar venda: ${error.error}`);
      }
    } catch (error) {
      console.error('Erro ao cancelar venda:', error);
      alert('Erro ao cancelar venda. Tente novamente.');
    }
  };

  const parcelasPagas = (
    parcelas: Array<{ baixa: string | null }>
  ) => {
    return parcelas.filter((p) => p.baixa).length;
  };

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allVendas.length + 1 : allVendas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 250 : 80),
    overscan: 5,
  });

  // Carrega mais quando chega perto do fim
  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= allVendas.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allVendas.length,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ]);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Vendas
        </h1>
        <Link
          href="/cliente/vendas/nova"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          + Nova Venda
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Pesquisar
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Número, sócio, matrícula ou convênio..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Status
            </label>
            <select
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Vendas */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Carregando vendas...
          </p>
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/20 p-12 rounded-lg shadow-md text-center">
          <p className="text-red-600 dark:text-red-400 text-lg">
            Erro ao carregar vendas. Tente novamente.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Recarregar
          </button>
        </div>
      ) : allVendas.length === 0 ? (
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
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: '600px' }}
          >
            <div className="w-full">
              {/* Header fixo - apenas desktop */}
              {!isMobile && (
                <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10 border-b border-gray-200 dark:border-gray-600">
                  <div className="grid grid-cols-[100px_2fr_1.5fr_120px_120px_120px_100px_200px] gap-4 px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <div>Venda</div>
                    <div>Sócio/Matrícula</div>
                    <div>Convênio</div>
                    <div>Data Emissão</div>
                    <div className="text-right">Parcelas</div>
                    <div className="text-right">Valor Total</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Ações</div>
                  </div>
                </div>
              )}

              {/* Virtual scrolling container */}
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const isLoaderRow = virtualRow.index > allVendas.length - 1;
                  const venda = allVendas[virtualRow.index];

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {isLoaderRow ? (
                        hasNextPage ? (
                          <div className="p-4 text-center text-gray-600 dark:text-gray-400">
                            Carregando mais vendas...
                          </div>
                        ) : null
                      ) : isMobile ? (
                        // Layout Mobile (Card)
                        <div className="p-4 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  Venda #{venda.numeroVenda}
                                </div>
                                {venda.operador && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Op: {venda.operador}
                                  </div>
                                )}
                              </div>
                              <div>
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
                              </div>
                            </div>

                            <div className="text-sm text-gray-900 dark:text-white">
                              <strong>Sócio:</strong> {venda.socio.nome}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Mat: {venda.socio.matricula || 'N/A'}
                            </div>

                            <div className="text-sm text-gray-900 dark:text-white">
                              <strong>Convênio:</strong>{' '}
                              {venda.convenio?.razao_soc || 'Sem convênio'}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Data Emissão
                                </div>
                                <div className="text-gray-900 dark:text-white">
                                  {format(new Date(venda.dataEmissao), 'dd/MM/yyyy')}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Parcelas
                                </div>
                                <div className="text-gray-900 dark:text-white">
                                  {parcelasPagas(venda.parcelas)}/
                                  {venda.quantidadeParcelas}
                                </div>
                              </div>
                            </div>

                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              Valor Total: R${' '}
                              {parseFloat(venda.valorTotal.toString()).toFixed(2)}
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Link
                                href={`/cliente/vendas/editar/${venda.id}`}
                                className="flex-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs text-center"
                              >
                                {venda.ativo && !venda.cancelado ? 'Editar' : 'Ver'}
                              </Link>
                              {venda.ativo && !venda.cancelado && (
                                <button
                                  onClick={() =>
                                    excluirVenda(
                                      venda.id,
                                      venda.numeroVenda,
                                      venda.socio.nome
                                    )
                                  }
                                  className="flex-1 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs text-center"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Layout Desktop (Grid)
                        <div className="grid grid-cols-[100px_2fr_1.5fr_120px_120px_120px_100px_200px] gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              #{venda.numeroVenda}
                            </div>
                            {venda.operador && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Op: {venda.operador}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {venda.socio.nome}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Mat: {venda.socio.matricula || 'N/A'}
                            </div>
                          </div>

                          <div className="text-sm text-gray-900 dark:text-white">
                            {venda.convenio?.razao_soc || 'Sem convênio'}
                          </div>

                          <div className="text-sm text-gray-900 dark:text-white">
                            {format(new Date(venda.dataEmissao), 'dd/MM/yyyy')}
                          </div>

                          <div className="text-right">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {parcelasPagas(venda.parcelas)}/
                              {venda.quantidadeParcelas}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              R${' '}
                              {parseFloat(venda.valorParcela.toString()).toFixed(2)}
                              /parc
                            </div>
                          </div>

                          <div className="text-sm font-medium text-gray-900 dark:text-white text-right">
                            R$ {parseFloat(venda.valorTotal.toString()).toFixed(2)}
                          </div>

                          <div className="text-center">
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
                          </div>

                          <div className="flex justify-center gap-2">
                            <Link
                              href={`/cliente/vendas/editar/${venda.id}`}
                              className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                              title={venda.ativo && !venda.cancelado ? "Editar venda" : "Ver detalhes"}
                            >
                              {venda.ativo && !venda.cancelado ? 'Editar' : 'Ver'}
                            </Link>
                            {venda.ativo && !venda.cancelado && (
                              <button
                                onClick={() =>
                                  excluirVenda(
                                    venda.id,
                                    venda.numeroVenda,
                                    venda.socio.nome
                                  )
                                }
                                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                title="Cancelar venda"
                              >
                                Cancelar
              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Vendas carregadas: <strong>{allVendas.length}</strong>
                {hasNextPage && ' (carregue mais com scroll)'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Valor total:{' '}
                <strong>
                  R${' '}
                  {allVendas
                    .reduce(
                      (sum, v) => sum + parseFloat(v.valorTotal.toString()),
                      0
                    )
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

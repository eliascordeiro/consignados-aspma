'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pencil, Trash2, Eye, Plus } from 'lucide-react';

// ===================================================================
// COMPONENTES DE FILTRO
// ===================================================================

function FiltroEmpresa({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: empresas } = useQuery({
    queryKey: ['empresas-filtro'],
    queryFn: async () => {
      const res = await fetch('/api/empresas?limit=1000');
      if (!res.ok) throw new Error('Erro ao carregar empresas');
      const json = await res.json();
      return json.data || [];
    },
    staleTime: 300000, // 5 minutos
  });

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Todas</option>
      {empresas?.map((emp: any) => (
        <option key={emp.id} value={emp.id}>
          {emp.nome}
        </option>
      ))}
    </select>
  );
}

function FiltroSocio({ value, onChange, empresaId }: { value: string; onChange: (value: string) => void; empresaId: string }) {
  const { data: socios } = useQuery({
    queryKey: ['socios-filtro', empresaId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10000', ativo: 'true' });
      if (empresaId) params.set('empresaId', empresaId);
      const res = await fetch(`/api/funcionarios?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar sócios');
      const json = await res.json();
      return json.data || [];
    },
    staleTime: 300000, // 5 minutos
    enabled: true,
  });

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Todos</option>
      {socios?.map((socio: any) => (
        <option key={socio.id} value={socio.id}>
          {socio.matricula} - {socio.nome}
        </option>
      ))}
    </select>
  );
}

function FiltroConvenio({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: convenios } = useQuery({
    queryKey: ['convenios-filtro'],
    queryFn: async () => {
      const res = await fetch('/api/convenios?limit=1000');
      if (!res.ok) throw new Error('Erro ao carregar convênios');
      const json = await res.json();
      return json.data || [];
    },
    staleTime: 300000, // 5 minutos
  });

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Todos</option>
      {convenios?.map((conv: any) => (
        <option key={conv.id} value={conv.id}>
          {conv.razao_soc}
        </option>
      ))}
    </select>
  );
}

// ===================================================================
// INTERFACES
// ===================================================================

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
    fantasia: string | null;
  } | null;
  parcelas: Array<{
    id: string;
    numeroParcela: number;
    baixa: string | null;
  }>;
}

interface VendasResponse {
  data: Venda[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    valorTotalGeral: number;
    totalParcelas: number;
    valorTotalParcelas: number;
  };
}

async function fetchVendas({
  page = 1,
  filtroAtivo,
  searchTerm,
  empresaId,
  socioId,
  convenioId,
  mesVencimento,
}: {
  page?: number;
  filtroAtivo: string;
  searchTerm: string;
  empresaId: string;
  socioId: string;
  convenioId: string;
  mesVencimento: string;
}): Promise<VendasResponse> {
  const params = new URLSearchParams();
  
  params.set('page', page.toString());
  params.set('limit', '50');
  
  if (filtroAtivo) {
    params.set('ativo', filtroAtivo);
  }
  
  if (searchTerm) {
    params.set('search', searchTerm);
  }

  if (empresaId) {
    params.set('empresaId', empresaId);
  }

  if (socioId) {
    params.set('socioId', socioId);
  }

  if (convenioId) {
    params.set('convenioId', convenioId);
  }

  if (mesVencimento) {
    params.set('mesVencimento', mesVencimento);
  }

  const response = await fetch(`/api/vendas?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Erro ao carregar vendas');
  }
  
  return response.json();
}

export default function VendasPage() {
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canCreate = hasPermission(userPermissions, 'vendas.create');
  const canEdit = hasPermission(userPermissions, 'vendas.edit');
  const canDelete = hasPermission(userPermissions, 'vendas.delete');

  const [filtroAtivo, setFiltroAtivo] = useState('true');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [socioId, setSocioId] = useState('');
  const [convenioId, setConvenioId] = useState('');
  const [mesVencimento, setMesVencimento] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1); // Reset page on search
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroAtivo, empresaId, socioId, convenioId, mesVencimento]);

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
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['vendas', filtroAtivo, searchTerm, currentPage, empresaId, socioId, convenioId, mesVencimento],
    queryFn: () => fetchVendas({ page: currentPage, filtroAtivo, searchTerm, empresaId, socioId, convenioId, mesVencimento }),
    staleTime: 60000, // 1 minuto
  });

  const vendas = data?.data ?? [];
  const pagination = data?.pagination;

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
    count: vendas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 150 : 56),
    overscan: 10,
  });

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gerencie as vendas e consignações</p>
        </div>
        {canCreate && (
          <Link
            href="/cliente/vendas/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nova Venda</span>
            <span className="sm:hidden">Nova</span>
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pesquisar
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Número, sócio, matrícula ou convênio..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Cancelados</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mês de Vencimento
            </label>
            <input
              type="month"
              value={mesVencimento}
              onChange={(e) => setMesVencimento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Consignatária
            </label>
            <FiltroEmpresa value={empresaId} onChange={setEmpresaId} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sócio
            </label>
            <FiltroSocio value={socioId} onChange={setSocioId} empresaId={empresaId} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Convênio
            </label>
            <FiltroConvenio value={convenioId} onChange={setConvenioId} />
          </div>

        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Atualizar
          </button>
          {(empresaId || socioId || convenioId || mesVencimento) && (
            <button
              onClick={() => {
                setEmpresaId('');
                setSocioId('');
                setConvenioId('');
                setMesVencimento('');
              }}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista de Vendas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando vendas...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-red-600 dark:text-red-400 text-sm mb-4">Erro ao carregar vendas. Tente novamente.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Recarregar
            </button>
          </div>
        ) : vendas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {searchTerm ? 'Nenhuma venda encontrada com os filtros aplicados.' : 'Nenhuma venda cadastrada.'}
            </p>
            {canCreate && (
              <Link
                href="/cliente/vendas/nova"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <Plus size={14} />
                Cadastrar primeira venda
              </Link>
            )}
          </div>
        ) : (
          <>
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: '600px' }}
          >
            <div className="w-full">
              {/* Header fixo - apenas desktop */}
              {!isMobile && (
                <div className="sticky top-0 z-10">
                  <div className="grid grid-cols-[70px_1.8fr_1.5fr_90px_80px_100px_80px_100px] gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    <div>Venda</div>
                    <div>Sócio</div>
                    <div>Convênio</div>
                    <div>Emissão</div>
                    <div className="text-center">Parc.</div>
                    <div className="text-right">Total</div>
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
                  const venda = vendas[virtualRow.index];

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
                      {isMobile ? (
                        // Layout Mobile (Card)
                        <div className="p-4 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/30">
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
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                    Cancelado
                                  </span>
                                ) : venda.ativo ? (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    Ativo
                                  </span>
                                ) : (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
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
                              {venda.convenio?.razao_soc || venda.observacoes || 'Sem convênio'}
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
                                  {venda.quantidadeParcelas}
                                </div>
                              </div>
                            </div>

                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              Valor Total: R${' '}
                              {parseFloat(venda.valorTotal.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>

                            <div className="flex gap-2 pt-2">
                              {canEdit && (
                                <Link
                                  href={`/cliente/vendas/editar/${venda.id}`}
                                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                                  title={venda.ativo && !venda.cancelado ? 'Editar venda' : 'Ver detalhes'}
                                >
                                  {venda.ativo && !venda.cancelado ? <Pencil size={16} /> : <Eye size={16} />}
                                </Link>
                              )}
                              {canDelete && venda.ativo && !venda.cancelado && (
                                <button
                                  onClick={() => excluirVenda(venda.id, venda.numeroVenda, venda.socio.nome)}
                                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                  title="Cancelar venda"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Layout Desktop (Grid)
                        <div className="grid grid-cols-[70px_1.8fr_1.5fr_90px_80px_100px_80px_100px] gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 items-center transition-colors duration-150">
                          <div className="text-left">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              #{venda.numeroVenda}
                            </div>
                          </div>

                          <div className="text-left overflow-hidden">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={venda.socio.nome}>
                              {venda.socio.nome}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {venda.socio.matricula || 'S/Mat'}
                            </div>
                          </div>

                          <div className="text-left overflow-hidden">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={venda.convenio?.razao_soc || venda.observacoes || 'Sem convênio'}>
                              {venda.convenio?.razao_soc || venda.observacoes || 'S/Conv'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={venda.convenio?.fantasia || ''}>
                              {venda.convenio?.fantasia || ''}
                            </div>
                          </div>

                          <div className="text-sm text-gray-900 dark:text-white text-left">
                            {format(new Date(venda.dataEmissao), 'dd/MM/yy')}
                          </div>

                          <div className="text-center">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {venda.quantidadeParcelas}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              R$ {parseFloat(venda.valorParcela.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                            R$ {parseFloat(venda.valorTotal.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>

                          <div className="flex justify-center">
                            {venda.cancelado ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap">
                                Cancel
                              </span>
                            ) : venda.ativo ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap">
                                Ativo
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300 whitespace-nowrap">
                                Inativo
                              </span>
                            )}
                          </div>

                          <div className="flex justify-center gap-1">
                            {canEdit && (
                              <Link
                                href={`/cliente/vendas/editar/${venda.id}`}
                                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                                title={venda.ativo && !venda.cancelado ? 'Editar venda' : 'Ver detalhes'}
                              >
                                {venda.ativo && !venda.cancelado ? <Pencil size={16} /> : <Eye size={16} />}
                              </Link>
                            )}
                            {canDelete && venda.ativo && !venda.cancelado && (
                              <button
                                onClick={() => excluirVenda(venda.id, venda.numeroVenda, venda.socio.nome)}
                                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                title="Cancelar venda"
                              >
                                <Trash2 size={16} />
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

          {/* Paginação */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Mostrando <strong>{vendas.length}</strong> de <strong>{pagination?.total || 0}</strong> vendas
              </p>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
                    {currentPage} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
                  >
                    Próxima
                  </button>
                </div>
              )}

              {pagination && pagination.totalParcelas > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Total:{' '}
                  <strong>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(pagination.valorTotalParcelas || 0))}
                  </strong>
                  <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">
                    ({pagination.totalParcelas} parcela{pagination.totalParcelas !== 1 ? 's' : ''})
                  </span>
                </p>
              )}
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

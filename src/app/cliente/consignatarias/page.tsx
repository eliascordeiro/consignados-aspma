'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pencil, Trash2 } from 'lucide-react';

interface Empresa {
  id: number;
  nome: string;
  cnpj?: string;
  tipo: string;
  telefone?: string;
  email?: string;
  contato?: string;
  ativo: boolean;
}

interface EmpresasResponse {
  data: Empresa[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchEmpresas({ page = 1, searchTerm }: { page?: number; searchTerm: string }): Promise<EmpresasResponse> {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', '50');
  if (searchTerm) params.set('search', searchTerm);
  const response = await fetch(`/api/consignatarias?${params.toString()}`);
  if (!response.ok) throw new Error('Erro ao carregar consignatárias');
  const json = await response.json();
  if (Array.isArray(json)) {
    return { data: json, pagination: { page: 1, limit: 50, total: json.length, totalPages: 1 } };
  }
  return json;
}

export default function ConsignatariasPage() {
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canCreate = hasPermission(userPermissions, 'consignatarias.create');
  const canEdit = hasPermission(userPermissions, 'consignatarias.edit');
  const canDelete = hasPermission(userPermissions, 'consignatarias.delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(searchInput); setCurrentPage(1); }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['consignatarias', searchTerm, currentPage],
    queryFn: () => fetchEmpresas({ page: currentPage, searchTerm }),
    staleTime: 60000,
  });

  const empresas = data?.data ?? [];
  const pagination = data?.pagination;

  const excluirEmpresa = async (empresa: Empresa) => {
    if (!confirm(`Tem certeza que deseja excluir "${empresa.nome}"?`)) return;
    try {
      const response = await fetch(`/api/consignatarias/${empresa.id}`, { method: 'DELETE' });
      if (response.ok) {
        refetch();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao excluir consignatária');
      }
    } catch {
      alert('Erro ao excluir consignatária');
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: empresas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 180 : 64),
    overscan: 5,
  });

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  return (
    <div className="container mx-auto p-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Consignatárias
        </h1>
        {canCreate && (
          <Link
            href="/cliente/consignatarias/nova"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Nova Consignatária
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Pesquisar
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nome, CNPJ ou status (ativo/inativo)..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/20 p-12 rounded-lg shadow-md text-center">
          <p className="text-red-600 dark:text-red-400 text-lg">
            Erro ao carregar consignatárias. Tente novamente.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Recarregar
          </button>
        </div>
      ) : empresas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-md text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {searchTerm
              ? 'Nenhuma consignatária encontrada com os filtros aplicados.'
              : 'Nenhuma consignatária cadastrada.'}
          </p>
          {canCreate && (
            <Link
              href="/cliente/consignatarias/nova"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Cadastrar primeira consignatária
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: '600px' }}
          >
            <div className="w-full">
              {/* Header fixo — desktop */}
              {!isMobile && (
                <div className="sticky top-0 bg-gray-50 dark:bg-gray-900/50 z-10 border-b border-gray-200 dark:border-gray-600">
                  <div className="grid grid-cols-[3fr_1.5fr_1fr_90px_100px] gap-2 px-3 py-3 font-semibold text-sm text-gray-700 dark:text-gray-300">
                    <div>Nome</div>
                    <div>Contato</div>
                    <div>Tipo</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Ações</div>
                  </div>
                </div>
              )}

              {/* Virtual scrolling */}
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const empresa = empresas[virtualRow.index];
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
                        /* Card mobile */
                        <div className="p-4 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                {empresa.nome}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {canEdit && (
                                  <Link
                                    href={`/cliente/consignatarias/editar/${empresa.id}`}
                                    className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                    title="Editar"
                                  >
                                    <Pencil size={14} />
                                  </Link>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => excluirEmpresa(empresa)}
                                    className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              {empresa.cnpj && <div>CNPJ: {empresa.cnpj}</div>}
                              {empresa.contato && <div>Contato: {empresa.contato}</div>}
                              {empresa.telefone && <div>Tel: {empresa.telefone}</div>}
                              <div className="flex gap-3 pt-1">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${empresa.tipo === 'PUBLICO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                                  {empresa.tipo === 'PUBLICO' ? 'Público' : 'Privado'}
                                </span>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${empresa.ativo ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                  {empresa.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Linha desktop */
                        <div className="grid grid-cols-[3fr_1.5fr_1fr_90px_100px] gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/30 items-center transition-colors duration-150">
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={empresa.nome}>
                              {empresa.nome}
                            </div>
                            {empresa.cnpj && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{empresa.cnpj}</div>
                            )}
                          </div>

                          <div className="overflow-hidden text-xs text-gray-700 dark:text-gray-300">
                            {empresa.contato
                              ? <div className="truncate" title={empresa.contato}>{empresa.contato}</div>
                              : null}
                            {empresa.telefone
                              ? <div className="text-gray-500 dark:text-gray-400">{empresa.telefone}</div>
                              : null}
                            {!empresa.contato && !empresa.telefone && (
                              <span className="italic text-gray-400">—</span>
                            )}
                          </div>

                          <div>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${empresa.tipo === 'PUBLICO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                              {empresa.tipo === 'PUBLICO' ? 'Público' : 'Privado'}
                            </span>
                          </div>

                          <div className="flex justify-center">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${empresa.ativo ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'}`}>
                              {empresa.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>

                          <div className="flex justify-center gap-1.5">
                            {canEdit && (
                              <Link
                                href={`/cliente/consignatarias/editar/${empresa.id}`}
                                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </Link>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => excluirEmpresa(empresa)}
                                className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors shadow-sm"
                                title="Excluir"
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
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Mostrando <strong>{empresas.length}</strong> de <strong>{pagination?.total || 0}</strong> consignatárias
                {pagination && ` (Página ${pagination.page} de ${pagination.totalPages})`}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Primeira página"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    «
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (pagination.totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    »
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={currentPage === pagination.totalPages}
                    className="px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Última página"
                  >
                    »»
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

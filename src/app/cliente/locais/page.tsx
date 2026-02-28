'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pencil, Trash2 } from 'lucide-react';

interface Convenio {
  id: number;
  codigo?: string | null;
  razao_soc?: string | null;
  fantasia?: string | null;
  nome: string;
  cnpj?: string | null;
  libera?: string | null;
  banco?: string | null;
  agencia?: string | null;
  ativo: boolean;
}

interface ConveniosResponse {
  data: Convenio[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function getDisplayTipo(libera: string | null | undefined): string {
  if (libera === 'X') return 'BANCO';
  if (libera === 'T') return 'TESTE';
  return 'COMÉRCIO';
}

function getTipoBadgeCls(libera: string | null | undefined): string {
  if (libera === 'X') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (libera === 'T') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
}

async function fetchConvenios({ page = 1, searchTerm }: { page?: number; searchTerm: string }): Promise<ConveniosResponse> {
  const params = new URLSearchParams({ search: searchTerm, page: String(page), limit: '50' });
  const res = await fetch(`/api/convenios?${params}`);
  if (!res.ok) throw new Error('Erro ao carregar convênios');
  const json = await res.json();
  if (Array.isArray(json)) return { data: json, pagination: { page: 1, limit: 50, total: json.length, totalPages: 1 } };
  return json;
}

export default function LocaisPage() {
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canCreate = hasPermission(userPermissions, 'convenios.create');
  const canEdit = hasPermission(userPermissions, 'convenios.edit');
  const canDelete = hasPermission(userPermissions, 'convenios.delete');

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(searchInput); setCurrentPage(1); }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['locais', searchTerm, currentPage],
    queryFn: () => fetchConvenios({ page: currentPage, searchTerm }),
    staleTime: 60000,
  });

  const convenios = data?.data ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const rowVirtualizer = useVirtualizer({
    count: convenios.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 120 : 60),
    overscan: 10,
  });

  const handleDelete = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${nome}"?`)) return;
    try {
      const res = await fetch(`/api/convenios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        refetch();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao excluir convênio');
      }
    } catch {
      alert('Erro ao excluir convênio');
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Convênios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie os convênios autorizados (bancos, comércios, cooperativas, etc)</p>
        </div>
        {canCreate && (
          <Link
            href="/cliente/locais/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <span>+</span>
            <span className="hidden sm:inline">Novo Convênio</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Nome, CNPJ, tipo, cidade ou status..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Carregando...</div>
        ) : isError ? (
          <div className="text-center py-12 text-red-500">Erro ao carregar convênios</div>
        ) : convenios.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Nenhum convênio encontrado</div>
        ) : (
          <>
            {/* Desktop Header */}
            {!isMobile && (
              <div className="grid grid-cols-[90px_1fr_120px_150px_100px_100px] gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <div>Código</div>
                <div>Nome / Fantasia</div>
                <div>Tipo</div>
                <div>Banco</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>
            )}

            {/* Virtual scrolling */}
            <div ref={parentRef} className="overflow-auto" style={{ height: '600px' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const conv = convenios[virtualRow.index];
                  if (!conv) return null;
                  const nomePrincipal = conv.razao_soc || conv.nome;
                  return (
                    <div
                      key={conv.id}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 railway:hover:bg-gray-700"
                    >
                      {/* Mobile card */}
                      <div className="md:hidden p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{nomePrincipal}</div>
                          {conv.fantasia && conv.fantasia !== nomePrincipal && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.fantasia}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTipoBadgeCls(conv.libera)}`}>
                              {getDisplayTipo(conv.libera)}
                            </span>
                            {conv.codigo && <span className="text-xs text-gray-400 font-mono">#{conv.codigo}</span>}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${conv.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                              {conv.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {canEdit && (
                            <Link href={`/cliente/locais/editar/${conv.id}`} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(conv.id, nomePrincipal)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid md:grid-cols-[90px_1fr_120px_150px_100px_100px] gap-3 px-4 items-center h-full text-sm">
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{conv.codigo || '—'}</div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{nomePrincipal}</div>
                          {conv.fantasia && conv.fantasia !== nomePrincipal && (
                            <div className="text-xs text-gray-400 truncate">{conv.fantasia}</div>
                          )}
                        </div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTipoBadgeCls(conv.libera)}`}>
                            {getDisplayTipo(conv.libera)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {conv.banco ? (
                            <span>{conv.banco}{conv.agencia ? ` · Ag: ${conv.agencia}` : ''}</span>
                          ) : '—'}
                        </div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${conv.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {conv.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Link href={`/cliente/locais/editar/${conv.id}`} title="Editar" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(conv.id, nomePrincipal)} title="Excluir" className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {((currentPage - 1) * 50) + 1}–{Math.min(currentPage * 50, total)} de {total} convênios
            </span>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors">Anterior</button>
              <span className="px-3 py-1 text-sm bg-card text-card-foreground border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

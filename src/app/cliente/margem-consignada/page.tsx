'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Edit, History } from 'lucide-react';

interface Empresa { id: number; nome: string }
interface Socio {
  id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  limite: number | null;
  limiteCalculado?: number;
  fonteLimite?: string;
  empresa: Empresa | null;
  _count?: { margemHistoricos: number };
}

interface Response {
  socios: Socio[];
  total: number;
  totalPages: number;
}

async function fetchSocios({ page = 1, search }: { page?: number; search: string }): Promise<Response> {
  const params = new URLSearchParams({ search, page: String(page), limit: '50' });
  const res = await fetch(`/api/margem-consignada?${params}`);
  if (!res.ok) throw new Error('Erro ao carregar');
  return res.json();
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
};

export default function MargemConsignadaPage() {
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canView = hasPermission(userPermissions, 'margem.view');
  const canEdit = hasPermission(userPermissions, 'margem.edit');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['margem-consignada', search, currentPage],
    queryFn: () => fetchSocios({ page: currentPage, search }),
    staleTime: 60000,
  });

  const socios = data?.socios ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const rowVirtualizer = useVirtualizer({
    count: socios.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 110 : 56),
    overscan: 10,
  });

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Margem Consignada</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie limites de crédito e margens consignáveis dos sócios</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Nome, CPF ou matrícula..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <span className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
              {total} sócio{total !== 1 ? 's' : ''}
            </span>
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
          <div className="text-center py-12 text-red-500">Erro ao carregar dados</div>
        ) : socios.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Nenhum sócio encontrado</div>
        ) : (
          <>
            {/* Desktop Header */}
            {!isMobile && (
              <div className="grid grid-cols-[1fr_130px_130px_160px_110px_100px_90px] gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <div>Nome</div>
                <div>Matrícula</div>
                <div>CPF</div>
                <div>Empresa</div>
                <div className="text-right">Margem</div>
                <div className="text-center">Altera.</div>
                <div className="text-right">Ações</div>
              </div>
            )}

            {/* Virtual scrolling */}
            <div ref={parentRef} className="overflow-auto" style={{ height: '600px' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const socio = socios[virtualRow.index];
                  if (!socio) return null;
                  const isZetra = socio.fonteLimite === 'ZETRA' || socio.fonteLimite === 'zetra';
                  const valorMargem = socio.limiteCalculado ?? socio.limite;
                  const fonteBadge = isZetra ? 'ZETRA' : socio.fonteLimite === 'local' || socio.fonteLimite === 'Local' ? 'Local' : socio.fonteLimite ? 'BD' : '';
                  return (
                    <div
                      key={socio.id}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 railway:hover:bg-gray-700"
                    >
                      {/* Mobile card */}
                      <div className="md:hidden p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{socio.nome}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {socio.matricula && <span>Mat: {socio.matricula} · </span>}
                              {socio.empresa?.nome || 'Sem empresa'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {canEdit && (
                              <Link href={`/cliente/margem-consignada/editar/${socio.id}`} title="Alterar margem" className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors">
                                <Edit className="h-4 w-4" />
                              </Link>
                            )}
                            <Link href={`/cliente/margem-consignada/historico/${socio.id}`} title="Ver histórico" className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors">
                              <History className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isZetra ? (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">ZETRA</span>
                          ) : (
                            <span className={`text-sm font-mono font-semibold ${Number(valorMargem || 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                              {formatCurrency(valorMargem)}
                            </span>
                          )}
                          {fonteBadge && <span className="text-[10px] px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-gray-500">{fonteBadge}</span>}
                        </div>
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid md:grid-cols-[1fr_130px_130px_160px_110px_100px_90px] gap-3 px-4 items-center h-full text-sm">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{socio.nome}</div>
                        <div className="text-gray-500 dark:text-gray-400 font-mono text-xs">{socio.matricula || '—'}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">{socio.cpf || '—'}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs truncate">{socio.empresa?.nome || '—'}</div>
                        <div className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            {isZetra ? (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">ZETRA</span>
                            ) : (
                              <span className={`font-mono text-xs font-semibold ${Number(valorMargem || 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                {formatCurrency(valorMargem)}
                              </span>
                            )}
                            {fonteBadge && <span className="text-[10px] px-1 border border-gray-300 dark:border-gray-500 rounded text-gray-400">{fonteBadge}</span>}
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-xs px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-gray-500">
                            {socio._count?.margemHistoricos ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Link href={`/cliente/margem-consignada/editar/${socio.id}`} title="Alterar margem" className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors">
                              <Edit className="h-4 w-4" />
                            </Link>
                          )}
                          <Link href={`/cliente/margem-consignada/historico/${socio.id}`} title="Ver histórico" className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors">
                            <History className="h-4 w-4" />
                          </Link>
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
              {((currentPage - 1) * 50) + 1}–{Math.min(currentPage * 50, total)} de {total}
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

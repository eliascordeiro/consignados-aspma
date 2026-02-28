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
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const rowVirtualizer = useVirtualizer({
    count: empresas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 110 : 56),
    overscan: 10,
  });

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

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consignatárias</h1>
          <p className="text-sm text-muted-foreground">Gerencie as consignatárias cadastradas</p>
        </div>
        {canCreate && (
          <Link
            href="/cliente/consignatarias/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <span>+</span>
            <span className="hidden sm:inline">Nova Consignatária</span>
            <span className="sm:hidden">Nova</span>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Nome, CNPJ, tipo ou status (ativo/inativo)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : isError ? (
          <div className="text-center py-12 text-red-500">Erro ao carregar consignatárias</div>
        ) : empresas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhuma consignatária encontrada</div>
        ) : (
          <>
            {/* Desktop Header */}
            {!isMobile && (
              <div className="grid grid-cols-[3fr_1.5fr_110px_100px_90px] gap-3 px-4 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div>Nome</div>
                <div>Contato</div>
                <div>Tipo</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>
            )}

            {/* Virtual scrolling */}
            <div ref={parentRef} className="overflow-auto" style={{ height: '600px' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const empresa = empresas[virtualRow.index];
                  if (!empresa) return null;
                  return (
                    <div
                      key={empresa.id}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                      className="border-b border-border hover:bg-gray-100 dark:hover:bg-gray-700 railway:hover:bg-gray-700"
                    >
                      {/* Mobile card */}
                      <div className="md:hidden p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-foreground truncate">{empresa.nome}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {empresa.cnpj && <span>{empresa.cnpj} · </span>}
                            {empresa.contato || empresa.telefone || ''}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${empresa.tipo === 'PUBLICO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                              {empresa.tipo === 'PUBLICO' ? 'Público' : 'Privado'}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${empresa.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                              {empresa.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {canEdit && (
                            <Link href={`/cliente/consignatarias/editar/${empresa.id}`} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-muted-foreground transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => excluirEmpresa(empresa)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid md:grid-cols-[3fr_1.5fr_110px_100px_90px] gap-3 px-4 items-center h-full text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{empresa.nome}</div>
                          {empresa.cnpj && <div className="text-xs text-muted-foreground">{empresa.cnpj}</div>}
                        </div>
                        <div className="text-xs text-muted-foreground min-w-0">
                          {empresa.contato && <div className="truncate">{empresa.contato}</div>}
                          {empresa.telefone && <div className="text-muted-foreground">{empresa.telefone}</div>}
                          {!empresa.contato && !empresa.telefone && <span className="text-gray-400">—</span>}
                        </div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${empresa.tipo === 'PUBLICO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                            {empresa.tipo === 'PUBLICO' ? 'Público' : 'Privado'}
                          </span>
                        </div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${empresa.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                            {empresa.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Link href={`/cliente/consignatarias/editar/${empresa.id}`} title="Editar" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-muted-foreground transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => excluirEmpresa(empresa)} title="Excluir" className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
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
          <div className="px-4 py-3 bg-muted/50 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {((currentPage - 1) * 50) + 1}–{Math.min(currentPage * 50, total)} de {total} consignatárias
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-border rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed text-muted-foreground transition-colors"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm bg-card text-card-foreground border border-border rounded-md text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-border rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed text-muted-foreground transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

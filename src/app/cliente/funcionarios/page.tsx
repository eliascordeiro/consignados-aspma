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
}

interface Funcionario {
  id: string;
  nome: string;
  matricula?: string;
  empresa?: Empresa | null;
  bloqueio?: string | null;
  ativo: boolean;
}

interface FuncionariosResponse {
  data: Funcionario[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchFuncionarios({ page = 1, searchTerm }: { page?: number; searchTerm: string }): Promise<FuncionariosResponse> {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', '50');
  if (searchTerm) params.set('search', searchTerm);
  const response = await fetch(`/api/funcionarios?${params.toString()}`);
  if (!response.ok) throw new Error('Erro ao carregar sócios');
  const json = await response.json();
  if (Array.isArray(json)) {
    return { data: json, pagination: { page: 1, limit: 50, total: json.length, totalPages: 1 } };
  }
  return json;
}

export default function FuncionariosPage() {
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canCreate = hasPermission(userPermissions, 'funcionarios.create');
  const canEdit = hasPermission(userPermissions, 'funcionarios.edit');
  const canDelete = hasPermission(userPermissions, 'funcionarios.delete');
  const canView = hasPermission(userPermissions, 'funcionarios.view');

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
    queryKey: ['funcionarios', searchTerm, currentPage],
    queryFn: () => fetchFuncionarios({ page: currentPage, searchTerm }),
    staleTime: 60000,
  });

  const funcionarios = data?.data ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const rowVirtualizer = useVirtualizer({
    count: funcionarios.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 100 : 56),
    overscan: 10,
  });

  const handleDelete = async (funcionario: Funcionario) => {
    if (!confirm(`Tem certeza que deseja excluir ${funcionario.nome}?`)) return;
    try {
      const response = await fetch(`/api/funcionarios/${funcionario.id}`, { method: 'DELETE' });
      if (response.ok) {
        refetch();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao excluir sócio');
      }
    } catch {
      alert('Erro ao excluir sócio');
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sócios</h1>
          <p className="text-sm text-muted-foreground">Gerencie os sócios das consignatárias</p>
        </div>
        {canCreate && (
          <Link
            href="/cliente/funcionarios/nova"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <span>+</span>
            <span className="hidden sm:inline">Novo Sócio</span>
            <span className="sm:hidden">Novo</span>
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
              placeholder="Nome, matrícula, CPF ou status..."
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
          <div className="text-center py-12 text-red-500">Erro ao carregar sócios</div>
        ) : funcionarios.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum sócio encontrado</div>
        ) : (
          <>
            {/* Desktop Header */}
            {!isMobile && (
              <div className="grid grid-cols-[140px_1fr_200px_110px_120px] gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div>Matrícula</div>
                <div>Nome</div>
                <div>Consignatária</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>
            )}

            {/* Virtual scrolling */}
            <div ref={parentRef} className="overflow-auto" style={{ height: '600px' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const func = funcionarios[virtualRow.index];
                  if (!func) return null;
                  const isAtivo = func.bloqueio !== 'X';
                  return (
                    <div
                      key={func.id}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                      className="border-b border-border hover:bg-gray-100 dark:hover:bg-gray-700 railway:hover:bg-gray-700"
                    >
                      {/* Mobile card */}
                      <div className="md:hidden p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-foreground truncate">{func.nome}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {func.matricula && <span>Mat: {func.matricula} · </span>}
                            {func.empresa?.nome || 'Sem consignatária'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAtivo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                            {isAtivo ? 'Ativo' : 'Inativo'}
                          </span>
                          {(canView || canEdit) && (
                            <Link href={`/cliente/funcionarios/editar/${func.id}`} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-muted-foreground transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(func)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid md:grid-cols-[140px_1fr_200px_110px_120px] gap-4 px-4 items-center h-full text-sm">
                        <div className="font-mono text-xs text-muted-foreground truncate">{func.matricula || '—'}</div>
                        <div className="font-medium text-foreground truncate">{func.nome}</div>
                        <div className="text-muted-foreground truncate text-xs">{func.empresa?.nome || 'Não informada'}</div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isAtivo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                            {isAtivo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1">
                          {(canView || canEdit) && (
                            <Link href={`/cliente/funcionarios/editar/${func.id}`} title="Editar" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-muted-foreground transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(func)} title="Excluir" className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
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
              {((currentPage - 1) * 50) + 1}–{Math.min(currentPage * 50, total)} de {total} sócios
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

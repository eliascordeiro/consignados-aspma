'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pencil, Trash2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  cpf?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  permissions?: string[];
}

async function fetchUsers(searchTerm: string): Promise<User[]> {
  const res = await fetch(`/api/cliente/usuarios?search=${encodeURIComponent(searchTerm)}`);
  if (!res.ok) throw new Error('Erro ao carregar usuários');
  return res.json();
}

export default function UsuariosPage() {
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canView = hasPermission(userPermissions, 'usuarios.view');
  const canCreate = hasPermission(userPermissions, 'usuarios.create');
  const canEdit = hasPermission(userPermissions, 'usuarios.edit');
  const canDelete = hasPermission(userPermissions, 'usuarios.delete');

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['usuarios', searchTerm],
    queryFn: () => fetchUsers(searchTerm),
    enabled: canView,
    staleTime: 60000,
  });

  const rowVirtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 100 : 56),
    overscan: 10,
  });

  const handleDelete = async (user: User) => {
    if (!confirm(`Tem certeza que deseja excluir "${user.name}"?`)) return;
    try {
      const res = await fetch(`/api/cliente/usuarios/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        refetch();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao excluir usuário');
      }
    } catch {
      alert('Erro ao excluir usuário');
    }
  };

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Você não tem permissão para visualizar usuários.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Usuários</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie os usuários com acesso ao sistema</p>
        </div>
        {canCreate && (
          <Link
            href="/cliente/usuarios/novo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <span>+</span>
            <span className="hidden sm:inline">Novo Usuário</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Nome, e-mail ou CPF..."
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Carregando...</div>
        ) : isError ? (
          <div className="text-center py-12 text-red-500">Erro ao carregar usuários</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Nenhum usuário encontrado</div>
        ) : (
          <>
            {!isMobile && (
              <div className="grid grid-cols-[2fr_2fr_130px_130px_100px_90px] gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <div>Nome</div>
                <div>E-mail</div>
                <div>CPF</div>
                <div>Telefone</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>
            )}

            <div ref={parentRef} className="overflow-auto" style={{ height: '600px' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const user = users[virtualRow.index];
                  if (!user) return null;
                  return (
                    <div
                      key={user.id}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 railway:hover:bg-gray-700"
                    >
                      <div className="md:hidden p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${user.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                              {user.active ? 'Ativo' : 'Inativo'}
                            </span>
                            {user.cpf && <span className="text-xs text-gray-400">{user.cpf}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {canEdit && (
                            <Link href={`/cliente/usuarios/editar/${user.id}`} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(user)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="hidden md:grid md:grid-cols-[2fr_2fr_130px_130px_100px_90px] gap-3 px-4 items-center h-full text-sm">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                        <div className="text-gray-600 dark:text-gray-300 truncate">{user.email}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">{user.cpf || '—'}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">{user.phone || '—'}</div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {user.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Link href={`/cliente/usuarios/editar/${user.id}`} title="Editar" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(user)} title="Excluir" className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
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

            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-300">{users.length} usuário{users.length !== 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

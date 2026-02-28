'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  entityId?: string;
  entityName?: string;
  description: string;
  metadata?: unknown;
  ipAddress?: string;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  LOGIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  LOGOUT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  PASSWORD_RESET: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  EXPORT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  IMPORT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  VIEW: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const actionLabels: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  PASSWORD_RESET: 'Reset de Senha',
  EXPORT: 'Exportação',
  IMPORT: 'Importação',
  VIEW: 'Visualização',
};

const moduleLabels: Record<string, string> = {
  funcionarios: 'Sócios',
  consignatarias: 'Consignatárias',
  margem: 'Margem Consignada',
  usuarios: 'Usuários e Permissões',
  convenios: 'Conveniados',
  vendas: 'Vendas',
  relatorios: 'Relatórios',
  consignados: 'Consignados',
  auth: 'Autenticação',
  sistema: 'Sistema',
  logs: 'Log de Auditoria',
};

const MODULE_OPTIONS = [
  { value: 'consignatarias', label: 'Consignatárias' },
  { value: 'funcionarios', label: 'Sócios' },
  { value: 'margem', label: 'Margem Consignada' },
  { value: 'convenios', label: 'Conveniados' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'relatorios', label: 'Relatórios' },
  { value: 'usuarios', label: 'Usuários e Permissões' },
  { value: 'logs', label: 'Log de Auditoria' },
  { value: 'consignados', label: 'Consignados' },
  { value: 'auth', label: 'Autenticação' },
  { value: 'sistema', label: 'Sistema' },
];

const ACTION_OPTIONS = [
  { value: 'CREATE', label: 'Criação' },
  { value: 'UPDATE', label: 'Atualização' },
  { value: 'DELETE', label: 'Exclusão' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'PASSWORD_RESET', label: 'Reset de Senha' },
  { value: 'EXPORT', label: 'Exportação' },
  { value: 'IMPORT', label: 'Importação' },
];

export default function LogsPage() {
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canView = hasPermission(userPermissions, 'logs.view');
  const canExport = hasPermission(userPermissions, 'logs.export');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.append('search', search);
      if (moduleFilter !== 'all') params.append('module', moduleFilter);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      const res = await fetch(`/api/cliente/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, moduleFilter, actionFilter]);

  useEffect(() => { if (canView) fetchLogs(); }, [fetchLogs, canView]);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isMobile ? 130 : 64),
    overscan: 10,
  });

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({ limit: '10000' });
      if (search) params.append('search', search);
      if (moduleFilter !== 'all') params.append('module', moduleFilter);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      const res = await fetch(`/api/cliente/logs?${params}`);
      const data = await res.json();
      const headers = ['Data/Hora', 'Usuário', 'Ação', 'Módulo', 'Descrição', 'IP'];
      const rows = data.data.map((log: AuditLog) => [
        format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
        log.userName,
        actionLabels[log.action] || log.action,
        moduleLabels[log.module] || log.module,
        log.description,
        log.ipAddress || '-',
      ]);
      const csv = [headers.join(';'), ...rows.map((r: string[]) => r.join(';'))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-auditoria-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Você não tem permissão para visualizar logs de auditoria.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Logs de Auditoria</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Histórico de ações realizadas no sistema</p>
        </div>
        {canExport && (
          <button
            onClick={exportLogs}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">Exportar</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Usuário, descrição..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Módulo</label>
            <select
              value={moduleFilter}
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os módulos</option>
              {MODULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ação</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas as ações</option>
              {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Nenhum log encontrado</div>
        ) : (
          <>
            {/* Desktop header */}
            {!isMobile && (
              <div className="grid grid-cols-[160px_1fr_100px_130px_2fr_100px] gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                <div>Data/Hora</div>
                <div>Usuário</div>
                <div>Ação</div>
                <div>Módulo</div>
                <div>Descrição</div>
                <div>IP</div>
              </div>
            )}

            <div ref={parentRef} className="overflow-auto" style={{ height: '600px' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const log = logs[virtualRow.index];
                  if (!log) return null;
                  const actionCls = actionColors[log.action] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
                  return (
                    <div
                      key={log.id}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 railway:hover:bg-gray-700"
                    >
                      {/* Mobile card */}
                      <div className="md:hidden p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{log.userName}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({log.userRole})</span>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${actionCls}`}>
                            {actionLabels[log.action] || log.action}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{log.description}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300">
                            {moduleLabels[log.module] || log.module}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid md:grid-cols-[160px_1fr_100px_130px_2fr_100px] gap-3 px-4 items-center h-full text-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{log.userName}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{log.userRole}</div>
                        </div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${actionCls}`}>
                            {actionLabels[log.action] || log.action}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300">
                            {moduleLabels[log.module] || log.module}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 truncate" title={log.description}>
                          {log.description}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{log.ipAddress || '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && totalPages > 0 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Página {page} de {totalPages} &mdash; {total} registro{total !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors">
                Anterior
              </button>
              <span className="px-3 py-1 text-sm bg-card text-card-foreground border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors">
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

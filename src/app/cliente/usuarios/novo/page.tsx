'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSION_MODULES, AVAILABLE_PERMISSIONS } from '@/config/permissions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function NovoUsuarioPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canCreate = hasPermission(userPermissions, 'usuarios.create');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    active: true,
    permissions: [] as string[],
  });

  const set = (field: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const togglePermission = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter((p) => p !== id)
        : [...prev.permissions, id],
    }));
  };

  const toggleModule = (modulePermIds: string[]) => {
    const allSelected = modulePermIds.every((id) => formData.permissions.includes(id));
    setFormData((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !modulePermIds.includes(p))
        : [...new Set([...prev.permissions, ...modulePermIds])],
    }));
  };

  const selectAll = () =>
    setFormData((prev) => ({ ...prev, permissions: AVAILABLE_PERMISSIONS.map((p) => p.id) }));

  const clearAll = () =>
    setFormData((prev) => ({ ...prev, permissions: [] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/cliente/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push('/cliente/usuarios');
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao criar usuário');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Você não tem permissão para criar usuários.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/cliente/usuarios" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Voltar para Usuários
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">Novo Usuário</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados do usuário */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Dados do Usuário</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.name} onChange={(e) => set('name', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail <span className="text-red-500">*</span></label>
              <input type="email" required value={formData.email} onChange={(e) => set('email', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">CPF</label>
              <input type="text" value={formData.cpf} onChange={(e) => set('cpf', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
              <input type="text" value={formData.phone} onChange={(e) => set('phone', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="ativo-new" checked={formData.active} onChange={(e) => set('active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="ativo-new" className="text-sm text-gray-700 dark:text-gray-300">Ativo</label>
            </div>
          </div>
          <div className="px-6 pb-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ℹ️ O usuário deverá usar &quot;Criar ou Redefinir Senha&quot; na tela de login para definir sua senha inicial.
              </p>
            </div>
          </div>
        </div>

        {/* Permissões */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Permissões de Acesso</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dashboard está sempre disponível. Configure permissões específicas por módulo.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll}
                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Marcar todos
              </button>
              <button type="button" onClick={clearAll}
                className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Limpar
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {PERMISSION_MODULES.map((module) => {
              const modulePermIds = module.permissions.map((p) => p.id);
              const allSelected = modulePermIds.every((id) => formData.permissions.includes(id));
              const countSelected = modulePermIds.filter((id) => formData.permissions.includes(id)).length;
              const ModuleIcon = module.icon;
              return (
                <div key={module.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-2">
                      <ModuleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{module.name}</span>
                      {countSelected > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                          {countSelected}/{modulePermIds.length}
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => toggleModule(modulePermIds)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x-0">
                    {module.permissions.map((perm) => {
                      const PermIcon = perm.icon;
                      const checked = formData.permissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(perm.id)}
                            className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {PermIcon && <PermIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />}
                              {perm.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{perm.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Link href="/cliente/usuarios" className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Salvando...' : 'Criar Usuário'}
          </button>
        </div>
      </form>
    </div>
  );
}

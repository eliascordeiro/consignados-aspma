'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, PERMISSION_MODULES, AVAILABLE_PERMISSIONS } from '@/config/permissions';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface FormState {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
  active: boolean;
  permissions: string[];
}

const INITIAL: FormState = {
  name: '', email: '', password: '', cpf: '', phone: '', active: true, permissions: [],
};

export default function EditarUsuarioPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const userPermissions = (session?.user as any)?.permissions || [];
  const canEdit = hasPermission(userPermissions, 'usuarios.edit');
  const isManager = (session?.user as any)?.role === 'MANAGER';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormState>(INITIAL);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/cliente/usuarios/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Usuário não encontrado');
        return res.json();
      })
      .then((data) => {
        setFormData({
          name: data.name ?? '',
          email: data.email ?? '',
          password: '',
          cpf: data.cpf ?? '',
          phone: data.phone ?? '',
          active: data.active !== false,
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const togglePermission = (permId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
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
      const body: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        cpf: formData.cpf,
        phone: formData.phone,
        active: formData.active,
        permissions: formData.permissions,
      };
      if (formData.password) body.password = formData.password;

      const res = await fetch(`/api/cliente/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push('/cliente/usuarios');
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao atualizar usuário');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (disabled?: boolean) =>
    `w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      disabled
        ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
        : 'bg-background text-foreground'
    }`;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/cliente/usuarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Voltar para Usuários
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">Editar Usuário</h1>
      </div>

      {!canEdit && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg text-sm mb-6">
          Você está visualizando em modo somente leitura.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados do usuário */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Dados do Usuário</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit}
                className={inputCls(!canEdit)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">E-mail <span className="text-red-500">*</span></label>
              <input type="email" required value={formData.email} onChange={(e) => set('email', e.target.value)} disabled={!canEdit}
                className={inputCls(!canEdit)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nova Senha <span className="text-gray-400 font-normal">(deixe em branco para manter)</span></label>
              <input type="password" value={formData.password} onChange={(e) => set('password', e.target.value)} disabled={!canEdit}
                className={inputCls(!canEdit)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">CPF</label>
              <input type="text" value={formData.cpf} onChange={(e) => set('cpf', e.target.value)} disabled={!canEdit}
                className={inputCls(!canEdit)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Telefone</label>
              <input type="text" value={formData.phone} onChange={(e) => set('phone', e.target.value)} disabled={!canEdit}
                className={inputCls(!canEdit)} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="ativo-edit" checked={formData.active} onChange={(e) => set('active', e.target.checked)} disabled={!canEdit}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed" />
              <label htmlFor="ativo-edit" className="text-sm text-muted-foreground">Ativo</label>
            </div>
          </div>
        </div>

        {/* Permissões */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Permissões de Acesso</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Dashboard está sempre disponível. Configure permissões específicas por módulo.</p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <button type="button" onClick={selectAll}
                  className="px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:bg-muted/50 transition-colors">
                  Marcar todos
                </button>
                <button type="button" onClick={clearAll}
                  className="px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:bg-muted/50 transition-colors">
                  Limpar
                </button>
              </div>
            )}
          </div>
          <div className="p-6 space-y-4">
            {PERMISSION_MODULES.map((module) => {
              const modulePermIds = module.permissions.map((p) => p.id);
              const allSelected = modulePermIds.every((id) => formData.permissions.includes(id));
              const countSelected = modulePermIds.filter((id) => formData.permissions.includes(id)).length;
              const ModuleIcon = module.icon;
              const isBlocked = module.id === 'usuarios' && isManager;
              return (
                <div key={module.id} className={`border border-border rounded-lg overflow-hidden${isBlocked ? ' opacity-60' : ''}`}>
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/50/50">
                    <div className="flex items-center gap-2">
                      <ModuleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold text-foreground">{module.name}</span>
                      {!isBlocked && countSelected > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                          {countSelected}/{modulePermIds.length}
                        </span>
                      )}
                      {isBlocked && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full font-medium">
                          🔒 Restrito
                        </span>
                      )}
                    </div>
                    {canEdit && !isBlocked && (
                      <button type="button" onClick={() => toggleModule(modulePermIds)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x-0">
                    {module.permissions.map((perm) => {
                      const PermIcon = perm.icon;
                      const checked = isBlocked ? false : formData.permissions.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-3 p-3 transition-colors ${canEdit && !isBlocked ? 'cursor-pointer hover:bg-muted/50/30' : 'cursor-not-allowed'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => canEdit && !isBlocked && togglePermission(perm.id)}
                            disabled={!canEdit || isBlocked}
                            className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0 disabled:cursor-not-allowed"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                              {PermIcon && <PermIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                              {perm.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{perm.description}</div>
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
          <Link href="/cliente/usuarios" className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
            {canEdit ? 'Cancelar' : 'Voltar'}
          </Link>
          {canEdit && (
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

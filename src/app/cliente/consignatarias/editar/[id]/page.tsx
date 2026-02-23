'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function EditarConsignatariaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canEdit = hasPermission(userPermissions, 'consignatarias.edit');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    tipo: 'PUBLICO',
    telefone: '',
    email: '',
    contato: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    ativo: true,
  });

  useEffect(() => {
    const fetchEmpresa = async () => {
      try {
        const response = await fetch(`/api/consignatarias/${params.id}`);
        if (!response.ok) { setNotFound(true); return; }
        const data = await response.json();
        const e = data.data || data;
        setFormData({
          nome: e.nome || '',
          cnpj: e.cnpj || '',
          tipo: e.tipo || 'PUBLICO',
          telefone: e.telefone || '',
          email: e.email || '',
          contato: e.contato || '',
          cep: e.cep || '',
          rua: e.rua || '',
          numero: e.numero || '',
          bairro: e.bairro || '',
          cidade: e.cidade || '',
          uf: e.uf || '',
          ativo: e.ativo ?? true,
        });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchEmpresa();
  }, [params.id]);

  const set = (field: string, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/consignatarias/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar consignatária');
        return;
      }
      router.push('/cliente/consignatarias');
    } catch {
      alert('Erro ao salvar consignatária');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-600">Consignatária não encontrada.</p>
        <Link href="/cliente/consignatarias" className="mt-4 inline-block text-blue-600 hover:underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/cliente/consignatarias"
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Editar Consignatária
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">

          {/* Nome + CNPJ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Nome *
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={formData.nome}
                onChange={(e) => set('nome', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                CNPJ
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.cnpj}
                onChange={(e) => set('cnpj', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Tipo + Telefone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Tipo *
              </label>
              <select
                disabled={!canEdit}
                value={formData.tipo}
                onChange={(e) => set('tipo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="PUBLICO">Público</option>
                <option value="PRIVADO">Privado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Telefone
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Email + Contato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                disabled={!canEdit}
                value={formData.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Pessoa de Contato
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.contato}
                onChange={(e) => set('contato', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">CEP</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.cep}
                onChange={(e) => set('cep', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Rua</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.rua}
                onChange={(e) => set('rua', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Número</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.numero}
                onChange={(e) => set('numero', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Bairro</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.bairro}
                onChange={(e) => set('bairro', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cidade</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.cidade}
                onChange={(e) => set('cidade', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">UF</label>
              <input
                type="text"
                maxLength={2}
                disabled={!canEdit}
                value={formData.uf}
                onChange={(e) => set('uf', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              disabled={!canEdit}
              checked={formData.ativo}
              onChange={(e) => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="ativo" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Ativo
            </label>
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 mt-6">
          <Link
            href="/cliente/consignatarias"
            className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Cancelar
          </Link>
          {canEdit && (
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

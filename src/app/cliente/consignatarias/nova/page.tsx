'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function NovaConsignatariaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canCreate = hasPermission(userPermissions, 'consignatarias.create');

  const [saving, setSaving] = useState(false);
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
    diaCorte: '9',
    ativo: true,
  });

  const set = (field: string, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    try {
      const response = await fetch('/api/consignatarias', {
        method: 'POST',
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

  if (!canCreate) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-600">Sem permissão para criar consignatárias.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/cliente/consignatarias"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-white"
        >
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          Nova Consignatária
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-card text-card-foreground rounded-lg shadow-md p-6 space-y-6">

          {/* Nome + CNPJ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Nome *
              </label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => set('nome', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                CNPJ
              </label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => set('cnpj', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Tipo + Telefone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => set('tipo', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PUBLICO">Público</option>
                <option value="PRIVADO">Privado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Telefone
              </label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Email + Contato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Pessoa de Contato
              </label>
              <input
                type="text"
                value={formData.contato}
                onChange={(e) => set('contato', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">CEP</label>
              <input
                type="text"
                value={formData.cep}
                onChange={(e) => set('cep', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Rua</label>
              <input
                type="text"
                value={formData.rua}
                onChange={(e) => set('rua', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Número</label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => set('numero', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Bairro</label>
              <input
                type="text"
                value={formData.bairro}
                onChange={(e) => set('bairro', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Cidade</label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => set('cidade', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">UF</label>
              <input
                type="text"
                maxLength={2}
                value={formData.uf}
                onChange={(e) => set('uf', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Dia de Corte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Dia de Corte
                <span className="ml-1 text-xs text-muted-foreground/60">(1–31)</span>
              </label>
              <input
                type="number"
                min="1"
                max="31"
                disabled
                value={formData.diaCorte}
                title="Em breve: configurável por consignatária"
                className="w-full px-3 py-2 border border-border rounded bg-muted/50 text-muted-foreground cursor-not-allowed opacity-70 focus:outline-none"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">Configuração em breve disponível</p>
            </div>
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="ativo" className="text-sm text-muted-foreground cursor-pointer">
              Ativo
            </label>
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 mt-6">
          <Link
            href="/cliente/consignatarias"
            className="px-6 py-2 bg-muted text-foreground rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

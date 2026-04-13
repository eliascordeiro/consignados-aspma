'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

const LIBERA_OPTIONS = [
  { value: 'C', label: 'COMÉRCIO' },
  { value: 'X', label: 'BANCO' },
  { value: 'T', label: 'TESTE' },
];

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

function getTipoLabel(libera: string): string {
  if (libera === 'X') return 'BANCO';
  if (libera === 'T') return 'TESTE';
  return 'COMÉRCIO';
}

function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function NovoConvenioPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canCreate = hasPermission(userPermissions, 'convenios.create');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    codigo: '',
    razao_soc: '',
    fantasia: '',
    nome: '',
    cnpj: '',
    cgc: '',
    libera: 'C',
    desconto: '',
    parcelas: '',
    endereco: '',
    bairro: '',
    cep: '',
    cidade: '',
    estado: 'PR',
    telefone: '',
    fax: '',
    contato: '',
    email: '',
    banco: '',
    agencia: '',
    conta: '',
    ativo: true,
  });

  const set = (field: string, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // Busca o próximo código disponível automaticamente
  useEffect(() => {
    fetch('/api/convenios/proximo-codigo')
      .then((res) => res.json())
      .then((data) => {
        if (data.codigo) set('codigo', data.codigo);
      })
      .catch((err) => console.error('Erro ao buscar código:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        ...formData,
        desconto: formData.desconto ? parseFloat(formData.desconto) : null,
        parcelas: formData.parcelas ? parseInt(formData.parcelas) : null,
        tipo: getTipoLabel(formData.libera),
      };
      const res = await fetch('/api/convenios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push('/cliente/locais');
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao criar convênio');
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
        <div className="text-center py-12 text-muted-foreground">
          Você não tem permissão para criar convênios.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/cliente/locais" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Voltar para Convênios
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">Novo Convênio</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Principais */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Dados Principais</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">CPF / CNPJ</label>
              <input type="text" value={formData.cnpj} onChange={(e) => set('cnpj', formatCpfCnpj(e.target.value))} maxLength={18}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Razão Social <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.razao_soc} onChange={(e) => set('razao_soc', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input type="text" value={formData.codigo} readOnly disabled
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground cursor-not-allowed" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome / Fantasia</label>
              <input type="text" value={formData.fantasia} onChange={(e) => set('fantasia', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select value={formData.libera} onChange={(e) => set('libera', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500">
                {LIBERA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">% Desconto</label>
              <input type="number" step="0.01" value={formData.desconto} onChange={(e) => set('desconto', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Parcelas máx.</label>
              <input type="number" min="1" value={formData.parcelas} onChange={(e) => set('parcelas', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="ativo-new" checked={formData.ativo} onChange={(e) => set('ativo', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="ativo-new" className="text-sm text-muted-foreground">Ativo</label>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Endereço</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Endereço</label>
              <input type="text" value={formData.endereco} onChange={(e) => set('endereco', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Bairro</label>
              <input type="text" value={formData.bairro} onChange={(e) => set('bairro', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">CEP</label>
              <input type="text" value={formData.cep} onChange={(e) => set('cep', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cidade</label>
              <input type="text" value={formData.cidade} onChange={(e) => set('cidade', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">UF</label>
              <select value={formData.estado} onChange={(e) => set('estado', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500">
                {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Dados Bancários */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Dados Bancários</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Banco</label>
              <input type="text" value={formData.banco} onChange={(e) => set('banco', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Agência</label>
              <input type="text" value={formData.agencia} onChange={(e) => set('agencia', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Conta</label>
              <input type="text" value={formData.conta} onChange={(e) => set('conta', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Informações de Contato</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Telefone</label>
              <input type="text" value={formData.telefone} onChange={(e) => set('telefone', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Fax</label>
              <input type="text" value={formData.fax} onChange={(e) => set('fax', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Contato</label>
              <input type="text" value={formData.contato} onChange={(e) => set('contato', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">E-mail <span className="text-red-500">*</span></label>
              <input type="email" required value={formData.email} onChange={(e) => set('email', e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Link href="/cliente/locais" className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Salvando...' : 'Criar Convênio'}
          </button>
        </div>
      </form>
    </div>
  );
}

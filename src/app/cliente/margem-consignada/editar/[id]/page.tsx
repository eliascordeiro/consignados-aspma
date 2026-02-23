'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { ChevronLeft, Wallet } from 'lucide-react';

interface Socio {
  id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  limite: number | null;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
};

export default function EditarMargemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canEdit = hasPermission(userPermissions, 'margem.edit');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [socio, setSocio] = useState<Socio | null>(null);
  const [isReadonly, setIsReadonly] = useState(false);
  const [fonte, setFonte] = useState('');
  const [formData, setFormData] = useState({ limite: '', motivo: '', observacao: '' });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        // Buscar dados do sócio
        const socioRes = await fetch(`/api/funcionarios/${id}`);
        if (!socioRes.ok) throw new Error('Sócio não encontrado');
        const socioData = await socioRes.json();
        setSocio(socioData);

        // Buscar margem via API
        let limiteCalc = socioData.limite?.toString() || '0';
        let readonly = false;
        let fonteLabel = 'Banco de Dados';

        try {
          const margemRes = await fetch(`/api/socios/${id}/margem`);
          if (margemRes.ok) {
            const margemData = await margemRes.json();
            if (margemData.fonte === 'tempo_real' || margemData.tipo === 'zetra') {
              readonly = true;
              fonteLabel = 'ZETRA';
            } else if (margemData.tipo === 'calculo_local' || margemData.fonte === 'local') {
              fonteLabel = 'Cálculo Local';
            }
            const valor = margemData.margem || margemData.limite || 0;
            limiteCalc = Number(valor).toFixed(2);
          }
        } catch { /* usa limite do banco */ }

        setIsReadonly(readonly);
        setFonte(fonteLabel);
        setFormData({ limite: limiteCalc, motivo: '', observacao: '' });
      } catch {
        alert('Erro ao carregar dados');
        router.push('/cliente/margem-consignada');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadonly) return;
    if (!formData.motivo.trim()) {
      alert('Motivo é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/margem-consignada', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: id,
          limite: formData.limite,
          motivo: formData.motivo,
          observacao: formData.observacao,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Erro ao salvar');
        return;
      }
      router.push('/cliente/margem-consignada');
    } catch {
      alert('Erro ao salvar limite');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">Sem permissão para alterar margens.</p>
      </div>
    );
  }

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="container mx-auto p-6 max-w-lg">
      <Link href="/cliente/margem-consignada" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 mb-4 transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Voltar para Margem Consignada
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {isReadonly ? 'Consultar Margem (ZETRA)' : 'Alterar Margem Consignada'}
            </h1>
            {socio && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {socio.nome}{socio.matricula && ` — Mat. ${socio.matricula}`}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Carregando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Fonte dos dados */}
            {fonte && (
              <div className={`rounded-lg p-3 ${isReadonly ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Fonte dos Dados</p>
                <p className="text-sm font-medium mt-1 text-gray-900 dark:text-gray-100">
                  {fonte}
                  {isReadonly && <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">(Somente Consulta)</span>}
                </p>
              </div>
            )}

            {/* Valor da margem */}
            {isReadonly ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Margem Consignada (ZETRA)</p>
                <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(Number(formData.limite))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ⚠️ Valores de ZETRA não podem ser alterados manualmente
                </p>
              </div>
            ) : (
              <>
                {socio?.limite !== null && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Valor Atual</p>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Limite: <span className="font-mono font-semibold">{formatCurrency(socio?.limite)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Nova Margem Consignada</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.limite}
                    onChange={(e) => setFormData({ ...formData, limite: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Motivo da Alteração <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Reajuste salarial, Correção de valor..."
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Observação</label>
                  <textarea
                    placeholder="Observação adicional (opcional)"
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Link
                href="/cliente/margem-consignada"
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {isReadonly ? 'Fechar' : 'Cancelar'}
              </Link>
              {!isReadonly && (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar Alteração'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

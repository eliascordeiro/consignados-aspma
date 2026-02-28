'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import Link from 'next/link';
import { ChevronLeft, History, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface MargemHistorico {
  id: string;
  limiteAnterior: number | null;
  limiteNovo: number | null;
  margemAnterior: number | null;
  margemNova: number | null;
  motivo: string | null;
  observacao: string | null;
  createdAt: string;
  usuario: { id: string; name: string };
}

interface SocioHistorico {
  id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  limite: number | null;
  margemHistoricos: MargemHistorico[];
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
};

const formatDate = (date: string) =>
  new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const DiffIcon = ({ anterior, novo }: { anterior: number | null; novo: number | null }) => {
  const a = Number(anterior || 0);
  const n = Number(novo || 0);
  if (n > a) return <ArrowUp className="h-3 w-3 text-green-600 inline" />;
  if (n < a) return <ArrowDown className="h-3 w-3 text-red-600 inline" />;
  return <ArrowUpDown className="h-3 w-3 text-gray-400 inline" />;
};

export default function HistoricoMargemPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canView = hasPermission(userPermissions, 'margem.view');

  const [loading, setLoading] = useState(true);
  const [socio, setSocio] = useState<SocioHistorico | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/margem-consignada?socioId=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject('Erro ao carregar')))
      .then((data) => setSocio(data))
      .catch(() => setError('Erro ao carregar histórico'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">Sem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link href="/cliente/margem-consignada" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 mb-4 transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Voltar para Margem Consignada
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Histórico de Limite</h1>
            {socio && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                <strong>{socio.nome}</strong>
                {socio.matricula && ` — Mat. ${socio.matricula}`}
                {' · '}Limite atual:{' '}
                <span className="font-mono font-semibold">{formatCurrency(socio.limite)}</span>
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Carregando histórico...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : !socio?.margemHistoricos?.length ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma alteração registrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header */}
            <div className="grid grid-cols-[150px_140px_160px_160px_1fr] gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              <div>Data</div>
              <div>Usuário</div>
              <div className="text-right">Limite</div>
              <div className="text-right">Margem</div>
              <div>Motivo</div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {socio.margemHistoricos.map((h) => (
                <div key={h.id} className="grid grid-cols-[150px_140px_160px_160px_1fr] gap-3 px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(h.createdAt)}</div>
                  <div className="text-gray-700 dark:text-gray-300 text-xs truncate">{h.usuario.name}</div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs font-mono">
                      <span className="text-gray-400">{formatCurrency(h.limiteAnterior)}</span>
                      <DiffIcon anterior={h.limiteAnterior} novo={h.limiteNovo} />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(h.limiteNovo)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs font-mono">
                      <span className="text-gray-400">{formatCurrency(h.margemAnterior)}</span>
                      <DiffIcon anterior={h.margemAnterior} novo={h.margemNova} />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(h.margemNova)}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-gray-700 dark:text-gray-300" title={h.motivo || ''}>{h.motivo || '—'}</p>
                    {h.observacao && (
                      <p className="text-xs text-gray-400 truncate mt-0.5" title={h.observacao}>{h.observacao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

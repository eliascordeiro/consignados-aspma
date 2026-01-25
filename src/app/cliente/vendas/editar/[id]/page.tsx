'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Parcela {
  id?: string;
  numeroParcela: number;
  dataVencimento: string;
  valor: number;
  baixa: string | null;
}

export default function EditarVendaPage() {
  const router = useRouter();
  const params = useParams();
  const vendaId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingVenda, setLoadingVenda] = useState(true);
  const [formData, setFormData] = useState({
    socioId: '',
    socioNome: '',
    socioMatricula: '',
    convenioId: '',
    convenioNome: '',
    numeroVenda: 0,
    dataEmissao: '',
    operador: '',
    observacoes: '',
    quantidadeParcelas: 1,
    valorParcela: '',
    limite: 0,
  });

  const [auditInfo, setAuditInfo] = useState({
    createdBy: '',
    createdAt: '',
    updatedBy: '',
    updatedAt: '',
  });

  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  useEffect(() => {
    if (vendaId) {
      carregarVenda();
    }
  }, [vendaId]);

  const carregarVenda = async () => {
    try {
      setLoadingVenda(true);
      const response = await fetch(`/api/vendas/${vendaId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar venda');
      }

      const venda = await response.json();

      setFormData({
        socioId: venda.socioId,
        socioNome: venda.socio.nome,
        socioMatricula: venda.socio.matricula || '',
        convenioId: venda.convenioId?.toString() || '',
        convenioNome: venda.convenio?.razao_soc || '',
        numeroVenda: venda.numeroVenda,
        dataEmissao: venda.dataEmissao.split('T')[0],
        operador: venda.operador || '',
        observacoes: venda.observacoes || '',
        quantidadeParcelas: venda.quantidadeParcelas,
        valorParcela: venda.valorParcela.toString(),
        limite: venda.socio.limite || 0,
      });

      setAuditInfo({
        createdBy: venda.createdBy?.name || 'Sistema',
        createdAt: new Date(venda.createdAt).toLocaleString('pt-BR'),
        updatedBy: venda.updatedBy?.name || venda.createdBy?.name || 'Sistema',
        updatedAt: new Date(venda.updatedAt).toLocaleString('pt-BR'),
      });

      setParcelas(venda.parcelas.map((p: any) => ({
        id: p.id,
        numeroParcela: p.numeroParcela,
        dataVencimento: p.dataVencimento.split('T')[0],
        valor: parseFloat(p.valor),
        baixa: p.baixa,
      })));
    } catch (error) {
      console.error('Erro ao carregar venda:', error);
      alert('Erro ao carregar venda');
      router.push('/cliente/vendas');
    } finally {
      setLoadingVenda(false);
    }
  };

  const atualizarParcela = (index: number, campo: string, valor: any) => {
    const novasParcelas = [...parcelas];
    (novasParcelas[index] as any)[campo] = valor;
    setParcelas(novasParcelas);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parcelas.length === 0) {
      alert('Adicione ao menos uma parcela');
      return;
    }

    const valorTotal = parcelas.reduce((sum, p) => sum + p.valor, 0);

    const vendaData = {
      operador: formData.operador || null,
      observacoes: formData.observacoes || null,
      quantidadeParcelas: parcelas.length,
      valorParcela: parseFloat(formData.valorParcela),
      valorTotal,
      parcelas: parcelas.map((p) => ({
        id: p.id,
        numeroParcela: p.numeroParcela,
        dataVencimento: new Date(p.dataVencimento).toISOString(),
        valor: p.valor,
        baixa: p.baixa || null,
      })),
    };

    try {
      setLoading(true);
      const response = await fetch(`/api/vendas/${vendaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendaData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar venda');
      }

      alert('Venda atualizada com sucesso!');
      router.push('/cliente/vendas');
    } catch (error: any) {
      console.error('Erro ao atualizar venda:', error);
      alert(error.message || 'Erro ao atualizar venda. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingVenda) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">Carregando venda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Editar Venda #{formData.numeroVenda}
        </h1>
        <Link
          href="/cliente/vendas"
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
        {/* Dados do Sócio (readonly) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Matrícula</label>
            <input
              type="text"
              value={formData.socioMatricula}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Nome do Sócio</label>
            <input
              type="text"
              value={formData.socioNome}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Limite por Parcela</label>
            <input
              type="text"
              value={`R$ ${formData.limite.toFixed(2)}`}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 font-bold text-blue-600 dark:text-blue-400"
            />
          </div>
        </div>

        {/* Convênio (readonly) */}
        <div>
          <label className="block text-sm font-bold mb-2 dark:text-gray-300">Convênio</label>
          <input
            type="text"
            value={formData.convenioNome || 'Sem convênio'}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
          />
        </div>

        {/* Operador e Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Operador</label>
            <input
              type="text"
              value={formData.operador}
              onChange={(e) => setFormData({ ...formData, operador: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Data de Emissão</label>
            <input
              type="date"
              value={formData.dataEmissao}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Informações de Auditoria */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-sm font-bold mb-3 text-gray-900 dark:text-white">Informações de Auditoria</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Criado por:</span>{' '}
              <span className="text-gray-900 dark:text-white font-medium">{auditInfo.createdBy}</span>
              <div className="text-xs text-gray-500 dark:text-gray-400">{auditInfo.createdAt}</div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Última alteração por:</span>{' '}
              <span className="text-gray-900 dark:text-white font-medium">{auditInfo.updatedBy}</span>
              <div className="text-xs text-gray-500 dark:text-gray-400">{auditInfo.updatedAt}</div>
            </div>
          </div>
        </div>

        {/* Tabela de Parcelas */}
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Parcelas</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-left text-gray-900 dark:text-white">#</th>
                  <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-left text-gray-900 dark:text-white">Vencimento</th>
                  <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">Valor</th>
                  <th className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-center text-gray-900 dark:text-white">Baixa</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((parcela, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">{parcela.numeroParcela}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
                      <input
                        type="date"
                        value={parcela.dataVencimento}
                        onChange={(e) => atualizarParcela(index, 'dataVencimento', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={parcela.valor}
                        onChange={(e) => atualizarParcela(index, 'valor', parseFloat(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-center">
                      <input
                        type="text"
                        maxLength={1}
                        value={parcela.baixa || ''}
                        onChange={(e) => atualizarParcela(index, 'baixa', e.target.value.toUpperCase() || null)}
                        className="w-12 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-700 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">TOTAL:</td>
                  <td className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-right text-gray-900 dark:text-white">
                    R$ {parcelas.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 border border-gray-300 dark:border-gray-600"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-4 justify-end mt-6">
          <Link
            href="/cliente/vendas"
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}

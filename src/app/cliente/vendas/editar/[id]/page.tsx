'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [cancelando, setCancelando] = useState(false);
  const [vendaCancelada, setVendaCancelada] = useState(false);
  const [formData, setFormData] = useState({
    socioId: '',
    socioNome: '',
    socioMatricula: '',
    convenioId: '',
    convenioNome: '',
    convenioNumero: '',
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // ── Modal de alteração em massa ──────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [massaForm, setMassaForm] = useState({
    daParcela: 1,
    ateParcela: 1,
    alterarVencimento: true,
    novoVencimento: '',
    alterarValor: false,
    novoValor: '',
    alterarBaixa: false,
    novaBaixa: 'X' as 'X' | null,
  });
  const modalRef = useRef<HTMLDivElement>(null);

  const abrirModalMassa = () => {
    setMassaForm(prev => ({
      ...prev,
      daParcela: 1,
      ateParcela: parcelas.length,
      novoVencimento: parcelas.length > 0 ? parcelas[0].dataVencimento : '',
      novoValor: '',
      alterarVencimento: true,
      alterarValor: false,
    }));
    setModalAberto(true);
  };

  const aplicarAlteracaoEmMassa = () => {
    const de = Math.max(1, Math.min(massaForm.daParcela, parcelas.length));
    const ate = Math.max(de, Math.min(massaForm.ateParcela, parcelas.length));

    if (!massaForm.alterarVencimento && !massaForm.alterarValor && !massaForm.alterarBaixa) {
      alert('Selecione ao menos uma opção para alterar.');
      return;
    }

    if (massaForm.alterarVencimento && !massaForm.novoVencimento) {
      alert('Informe o vencimento inicial.');
      return;
    }

    const novoValorNum = massaForm.alterarValor ? parseFloat(massaForm.novoValor) : 0;
    if (massaForm.alterarValor && (isNaN(novoValorNum) || novoValorNum <= 0)) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    const novasParcelas = [...parcelas];

    for (let i = de - 1; i <= ate - 1; i++) {
      if (massaForm.alterarVencimento) {
        // Incrementa mês a mês a partir do novoVencimento
        const base = new Date(massaForm.novoVencimento + 'T12:00:00');
        const mesesOffset = i - (de - 1);
        const novaData = new Date(base);
        novaData.setMonth(novaData.getMonth() + mesesOffset);
        novasParcelas[i] = {
          ...novasParcelas[i],
          dataVencimento: novaData.toISOString().split('T')[0],
        };
      }
      if (massaForm.alterarValor) {
        novasParcelas[i] = { ...novasParcelas[i], valor: novoValorNum };
      }
      if (massaForm.alterarBaixa) {
        novasParcelas[i] = { ...novasParcelas[i], baixa: massaForm.novaBaixa };
      }
    }

    setParcelas(novasParcelas);
    setModalAberto(false);
  };

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
        convenioNome: venda.convenio?.razao_soc || venda.observacoes || 'Sem convênio',
        convenioNumero: venda.convenio?.codigo || '',
        numeroVenda: venda.numeroVenda,
        dataEmissao: venda.dataEmissao.split('T')[0],
        operador: venda.operador || '',
        observacoes: venda.observacoes || '',
        quantidadeParcelas: venda.quantidadeParcelas,
        valorParcela: venda.valorParcela.toString(),
        limite: venda.socio.limite || 0,
      });

      if (venda.cancelado) {
        setVendaCancelada(true);
      }

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

  const handleCancelarVenda = async () => {
    const confirmacao = window.confirm(
      `Tem certeza que deseja CANCELAR a venda #${formData.numeroVenda} de ${formData.socioNome}?\n\nEsta ação irá:\n- Liberar a margem na ZETRA (se aplicável)\n- Marcar a venda como cancelada\n\nEsta ação NÃO pode ser desfeita.`
    );

    if (!confirmacao) return;

    try {
      setCancelando(true);
      const response = await fetch(`/api/vendas/${vendaId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensagem || data.error || 'Erro ao cancelar venda');
      }

      alert('Venda cancelada com sucesso!');
      router.push('/cliente/vendas');
    } catch (error: any) {
      console.error('Erro ao cancelar venda:', error);
      alert(error.message || 'Erro ao cancelar venda. Tente novamente.');
    } finally {
      setCancelando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (vendaCancelada) {
      alert('Esta venda está cancelada e não pode ser alterada.');
      return;
    }

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
          <p className="text-muted-foreground">Carregando venda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Editar Venda #{formData.numeroVenda}
        </h1>
        <Link
          href="/cliente/vendas"
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
        >
          Voltar
        </Link>
      </div>

      {vendaCancelada && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-3">
          <span className="text-red-600 dark:text-red-400 text-lg">⛔</span>
          <span className="text-red-800 dark:text-red-300 font-semibold">Esta venda foi cancelada e não pode ser alterada.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card text-card-foreground p-6 rounded-lg shadow-md space-y-6">
        {/* Sócio/Associado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-2 text-muted-foreground">Nome do Associado *</label>
            <input
              type="text"
              value={formData.socioNome}
              readOnly
              className="w-full px-3 py-2 border border-border rounded bg-muted text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-muted-foreground">Matrícula</label>
            <input
              type="text"
              value={formData.socioMatricula}
              readOnly
              className="w-full px-3 py-2 border border-border rounded bg-muted text-foreground"
            />
          </div>
        </div>

        {/* Convênio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-2 text-muted-foreground">Convênio *</label>
            <input
              type="text"
              value={formData.convenioNome}
              readOnly
              className="w-full px-3 py-2 border border-border rounded bg-muted text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-muted-foreground">Código</label>
            <input
              type="text"
              value={formData.convenioNumero}
              readOnly
              className="w-full px-3 py-2 border border-border rounded bg-muted text-foreground"
            />
          </div>
        </div>

        {/* Data, Parcelas e Valor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2 text-muted-foreground">Data de Emissão *</label>
            <input
              type="date"
              value={formData.dataEmissao}
              readOnly
              className="w-full px-3 py-2 border border-border rounded bg-muted text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-muted-foreground">Nº de Parcelas *</label>
            <input
              type="number"
              value={formData.quantidadeParcelas}
              readOnly
              className="w-full px-3 py-2 border border-border rounded bg-muted text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-muted-foreground">Valor da Parcela *</label>
            <input
              type="text"
              value={`R$ ${parseFloat(formData.valorParcela || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              readOnly
              className="w-full px-3 py-2 border border-border rounded bg-muted text-foreground"
            />
          </div>
        </div>

        {/* Informações de Auditoria */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="text-sm font-bold mb-3 text-foreground">Informações de Auditoria</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Criado por:</span>{' '}
              <span className="text-foreground font-medium">{auditInfo.createdBy}</span>
              <div className="text-xs text-muted-foreground">{auditInfo.createdAt}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Última alteração por:</span>{' '}
              <span className="text-foreground font-medium">{auditInfo.updatedBy}</span>
              <div className="text-xs text-muted-foreground">{auditInfo.updatedAt}</div>
            </div>
          </div>
        </div>

        {/* Tabela de Parcelas */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground">Parcelas</h3>
            <button
              type="button"
              onClick={abrirModalMassa}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded font-medium transition-colors"
              title="Alterar valor e/ou baixa em sequência para um intervalo de parcelas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Alterar Parcelas
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-card text-card-foreground border border-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 border border-border text-left text-foreground">#</th>
                  <th className="px-4 py-2 border border-border text-left text-foreground">Vencimento (Mês/Ano)</th>
                  <th className="px-4 py-2 border border-border text-right text-foreground">Valor</th>
                  <th className="px-4 py-2 border border-border text-center text-foreground">Baixa</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((parcela, index) => {
                  const originalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                  return (
                    <tr key={originalIndex} className="hover:bg-muted/50">
                      <td className="px-4 py-2 border border-border text-foreground">{parcela.numeroParcela}</td>
                      <td className="px-4 py-2 border border-border text-foreground text-sm">
                        {new Date(parcela.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2 border border-border text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={parcela.valor}
                          onChange={(e) => atualizarParcela(originalIndex, 'valor', parseFloat(e.target.value))}
                          className="w-full px-2 py-1 border border-border rounded text-right bg-background text-foreground"
                        />
                      </td>
                      <td className="px-4 py-2 border border-border text-center">
                        <input
                          type="checkbox"
                          checked={parcela.baixa === 'X'}
                          onChange={(e) => atualizarParcela(originalIndex, 'baixa', e.target.checked ? 'X' : null)}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-2 border border-border text-right text-foreground">TOTAL:</td>
                  <td className="px-4 py-2 border border-border text-right text-foreground">
                    R$ {parcelas.reduce((sum, p) => sum + p.valor, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 border border-border"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Paginação */}
          {parcelas.length > ITEMS_PER_PAGE && (
            <div className="flex flex-wrap justify-center items-center gap-1 mt-4">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >←</button>
              {(() => {
                const total = Math.ceil(parcelas.length / ITEMS_PER_PAGE);
                const pages: (number | '...')[] = [];
                if (total <= 7) {
                  for (let i = 1; i <= total; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 3) pages.push('...');
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(total - 1, currentPage + 1); i++) pages.push(i);
                  if (currentPage < total - 2) pages.push('...');
                  pages.push(total);
                }
                return pages.map((p, i) => p === '...' ? (
                  <span key={`e${i}`} className="px-2 py-1 text-sm text-gray-500">…</span>
                ) : (
                  <button type="button" key={p} onClick={() => setCurrentPage(p as number)}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === p ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}>{p}</button>
                ));
              })()}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(parcelas.length / ITEMS_PER_PAGE), p + 1))}
                disabled={currentPage === Math.ceil(parcelas.length / ITEMS_PER_PAGE)}
                className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >→</button>
              <span className="text-xs text-muted-foreground ml-2">{parcelas.length} parcelas</span>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-4 justify-between mt-6">
          {!vendaCancelada && (
            <button
              type="button"
              onClick={handleCancelarVenda}
              disabled={cancelando || loading}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-medium"
            >
              {cancelando ? 'Cancelando...' : 'Cancelar Venda'}
            </button>
          )}
          <div className="flex gap-4 ml-auto">
            <Link
              href="/cliente/vendas"
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
            >
              Voltar
            </Link>
            {!vendaCancelada && (
              <button
                type="submit"
                disabled={loading || cancelando}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ── Modal Alterar Parcelas ─────────────────────────────────────────── */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalAberto(false); }}
        >
          <div
            ref={modalRef}
            className="bg-card text-card-foreground rounded-xl shadow-2xl border border-border w-full max-w-md mx-4 p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Alterar Parcelas</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aplica valor e/ou baixa em sequência a um intervalo de parcelas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
                title="Fechar"
              >✕</button>
            </div>

            {/* Intervalo de parcelas */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Da Parcela <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={parcelas.length}
                  value={massaForm.daParcela}
                  onChange={(e) => setMassaForm(f => ({ ...f, daParcela: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Até Parcela <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={parcelas.length}
                  value={massaForm.ateParcela}
                  onChange={(e) => setMassaForm(f => ({ ...f, ateParcela: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground text-sm"
                />
              </div>
            </div>

            {/* Seção Vencimento — desabilitada */}
            <div className="border border-border rounded-lg p-4 mb-4 opacity-40 cursor-not-allowed select-none" title="Alteração de vencimentos desabilitada">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-foreground">Alterar Vencimentos</span>
                <span className="text-xs text-muted-foreground ml-1">(desabilitado)</span>
              </label>
            </div>

            {/* Seção Valor */}
            <div className="border border-border rounded-lg p-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={massaForm.alterarValor}
                  onChange={(e) => setMassaForm(f => ({ ...f, alterarValor: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm font-semibold text-foreground">Alterar Valor</span>
              </label>
              {massaForm.alterarValor && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Novo valor para todas as parcelas no intervalo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={massaForm.novoValor}
                    onChange={(e) => setMassaForm(f => ({ ...f, novoValor: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground text-sm text-right"
                  />
                </div>
              )}
            </div>

            {/* Seção Baixa */}
            <div className="border border-border rounded-lg p-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={massaForm.alterarBaixa}
                  onChange={(e) => setMassaForm(f => ({ ...f, alterarBaixa: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm font-semibold text-foreground">Alterar Baixa</span>
              </label>
              {massaForm.alterarBaixa && (
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-border rounded bg-background flex-1 justify-center">
                    <input
                      type="radio"
                      name="novaBaixa"
                      value="X"
                      checked={massaForm.novaBaixa === 'X'}
                      onChange={() => setMassaForm(f => ({ ...f, novaBaixa: 'X' }))}
                      className="accent-green-500"
                    />
                    <span className="text-sm text-foreground">&#10003; Marcar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-border rounded bg-background flex-1 justify-center">
                    <input
                      type="radio"
                      name="novaBaixa"
                      value=""
                      checked={massaForm.novaBaixa === null}
                      onChange={() => setMassaForm(f => ({ ...f, novaBaixa: null }))}
                      className="accent-red-500"
                    />
                    <span className="text-sm text-foreground">&#10005; Desmarcar</span>
                  </label>
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 mb-5 text-xs text-amber-800 dark:text-amber-300">
              Afetará <strong>{Math.max(0, Math.min(massaForm.ateParcela, parcelas.length) - Math.max(1, massaForm.daParcela) + 1)}</strong> parcela(s)
              {' '}({massaForm.daParcela} a {Math.min(massaForm.ateParcela, parcelas.length)})
            </div>

            {/* Botões */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-5 py-2 text-sm rounded border border-border bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicarAlteracaoEmMassa}
                className="px-5 py-2 text-sm rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Convenio {
  id: number;
  codigo: string;
  razao_soc: string;
}

export default function RelatorioAtivosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canExport = hasPermission(userPermissions, 'relatorios.export');

  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [filtros, setFiltros] = useState({
    convenioId: '',
    convenioNome: '',
    mesAno: new Date().toISOString().slice(0, 7), // YYYY-MM
    agrupaPor: 'socio',
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchConvenio, setSearchConvenio] = useState('');
  const [showConvenioList, setShowConvenioList] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvOptions, setCsvOptions] = useState({
    delimiter: ';',
    encoding: 'utf-8',
    includeHeader: true,
    decimalSeparator: ',',
  });

  useEffect(() => {
    if (searchConvenio.length >= 2 && !filtros.convenioId) {
      carregarConvenios();
    } else if (searchConvenio.length < 2) {
      setShowConvenioList(false);
    }
  }, [searchConvenio]);

  const carregarConvenios = async () => {
    try {
      const response = await fetch(`/api/convenios?search=${searchConvenio}`);
      if (response.ok) {
        const data = await response.json();
        const conveniosData = data.data || data;
        if (Array.isArray(conveniosData)) {
          setConvenios(conveniosData);
          setShowConvenioList(true);
        } else {
          setConvenios([]);
        }
      } else {
        setConvenios([]);
      }
    } catch (error) {
      console.error('Erro ao carregar convênios:', error);
      setConvenios([]);
    }
  };

  const selecionarConvenio = (convenio: Convenio) => {
    setFiltros({ ...filtros, convenioId: convenio.id.toString(), convenioNome: convenio.razao_soc });
    setSearchConvenio(`${convenio.codigo} - ${convenio.razao_soc}`);
    setShowConvenioList(false);
    setConvenios([]);
  };

  const limparConvenio = () => {
    setFiltros({ ...filtros, convenioId: '', convenioNome: '' });
    setSearchConvenio('');
    setShowConvenioList(false);
    setConvenios([]);
  };

  // AS301.PRG: codtipo <> '3' AND codtipo <> '4' + baixa = '' (em aberto)
  const buildQueryParams = (formato: string) => {
    const params = new URLSearchParams({
      mesAno: filtros.mesAno,
      agrupaPor: filtros.agrupaPor,
      formato,
      tipoSocio: 'ativos',        // AS301.PRG: codtipo <> 3 e <> 4
      apenasEmAberto: 'true',      // AS301.PRG: TRIM(parcelas.baixa) = ''
    });
    if (filtros.convenioId) {
      params.set('convenioId', filtros.convenioId);
    }
    return params;
  };

  const gerarRelatorioPDF = async () => {
    if (!filtros.mesAno) { alert('Selecione o período (Mês-Ano)'); return; }
    setLoading(true);
    setProgress(10);
    try {
      const queryParams = buildQueryParams('pdf');
      setProgress(30);
      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      setProgress(60);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debitos-ativos-${filtros.mesAno}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        setTimeout(() => { setProgress(0); alert('Relatório PDF gerado com sucesso!'); }, 500);
      } else {
        const error = await response.json();
        alert(error.error || 'Erro desconhecido');
        setProgress(0);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const gerarRelatorioExcel = async () => {
    if (!filtros.mesAno) { alert('Selecione o período (Mês-Ano)'); return; }
    setLoading(true);
    setProgress(10);
    try {
      const queryParams = buildQueryParams('excel');
      setProgress(30);
      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      setProgress(60);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debitos-ativos-${filtros.mesAno}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        setTimeout(() => { setProgress(0); alert('Relatório Excel gerado com sucesso!'); }, 500);
      } else {
        const error = await response.json();
        alert(error.error || 'Erro desconhecido');
        setProgress(0);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const gerarRelatorioCSV = async () => {
    if (!filtros.mesAno) { alert('Selecione o período (Mês-Ano)'); return; }
    setLoading(true);
    setProgress(10);
    setShowCSVModal(false);
    try {
      const queryParams = buildQueryParams('csv');
      queryParams.set('delimiter', csvOptions.delimiter);
      queryParams.set('encoding', csvOptions.encoding);
      queryParams.set('includeHeader', csvOptions.includeHeader.toString());
      queryParams.set('decimalSeparator', csvOptions.decimalSeparator);
      setProgress(30);
      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      setProgress(60);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debitos-ativos-${filtros.mesAno}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        setTimeout(() => { setProgress(0); alert('Relatório CSV gerado com sucesso!'); }, 500);
      } else {
        const error = await response.json();
        alert(error.error || 'Erro desconhecido');
        setProgress(0);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const gerarRelatorioMySQLPDF = async () => {
    if (!filtros.mesAno) { alert('Selecione o período (Mês-Ano)'); return; }
    setLoading(true);
    setProgress(10);
    try {
      const params = new URLSearchParams({ mesAno: filtros.mesAno, formato: 'pdf' });
      if (filtros.convenioId) params.set('convenioId', filtros.convenioId);
      setProgress(30);
      const response = await fetch(`/api/relatorios/ativos-mysql?${params}`);
      setProgress(70);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ativos-mysql-${filtros.mesAno}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        setTimeout(() => { setProgress(0); alert('Relatório MySQL gerado com sucesso!'); }, 500);
      } else {
        const error = await response.json();
        alert(`Erro ao gerar relatório MySQL: ${error.error || 'Erro desconhecido'}`);
        setProgress(0);
      }
    } catch (error) {
      console.error('Erro ao gerar relatório MySQL:', error);
      alert('Erro ao gerar relatório MySQL. Tente novamente.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/cliente/relatorios"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title="Voltar para Relatórios"
          >
            ← Voltar
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-foreground">
          Relatório — Débitos de Associados
        </h1>
        <p className="text-muted-foreground mt-2">
          Parcelas em aberto de sócios ativos (Tipo diferente de 3 e 4) — Baseado no AS301.PRG
        </p>
      </div>

      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md max-w-md">
        <div className="space-y-4">
          {/* Agrupa por */}
          <div>
            <label className="block text-sm font-bold mb-2 text-foreground">
              Agrupa por *
            </label>
            <select
              value={filtros.agrupaPor}
              onChange={(e) => setFiltros({ ...filtros, agrupaPor: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="socio">Sócio</option>
              <option value="convenio">Convênio</option>
            </select>
          </div>

          {/* Convênio (opcional) */}
          <div className="relative">
            <label className="block text-sm font-bold mb-2 text-foreground">
              Convênio (opcional)
            </label>
            <input
              type="text"
              value={searchConvenio}
              onChange={(e) => {
                setSearchConvenio(e.target.value);
                if (!e.target.value) limparConvenio();
              }}
              placeholder="Digite código ou razão social (ou deixe vazio para todos)"
              className="w-full px-3 py-2 border border-border rounded bg-background text-foreground placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filtros.convenioId && (
              <button
                type="button"
                onClick={limparConvenio}
                className="absolute right-3 top-10 text-gray-500 hover:text-muted-foreground dark:hover:text-gray-200"
                title="Limpar seleção"
              >
                ✕
              </button>
            )}
            {showConvenioList && convenios.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded shadow-lg max-h-60 overflow-y-auto">
                {convenios.map((convenio) => (
                  <div
                    key={convenio.id}
                    onClick={() => selecionarConvenio(convenio)}
                    className="p-3 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer border-b border-border"
                  >
                    <div className="font-semibold text-foreground">{convenio.razao_soc}</div>
                    <div className="text-sm text-muted-foreground">
                      {convenio.codigo && <span>Código: {convenio.codigo}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Período */}
          <div>
            <label className="block text-sm font-bold mb-2 text-foreground">
              Período (Mês-Ano) *
            </label>
            <input
              type="month"
              value={filtros.mesAno}
              onChange={(e) => setFiltros({ ...filtros, mesAno: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Barra de Progresso */}
          {loading && (
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Botões */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            <button
              type="button"
              onClick={gerarRelatorioPDF}
              disabled={loading || !canExport}
              className="px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-bold"
              title={!canExport ? 'Sem permissão para exportar' : ''}
            >
              📄 PDF
            </button>
            <button
              type="button"
              onClick={gerarRelatorioExcel}
              disabled={loading || !canExport}
              className="px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-bold"
              title={!canExport ? 'Sem permissão para exportar' : ''}
            >
              📊 Excel
            </button>
            <button
              type="button"
              onClick={() => setShowCSVModal(true)}
              disabled={loading || !canExport}
              className="px-4 py-3 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-bold"
              title={!canExport ? 'Sem permissão para exportar' : ''}
            >
              📋 CSV
            </button>
          </div>

          {/* Botão MySQL - Banco Legado */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 border-t border-dashed border-gray-300 dark:border-gray-600" />
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">Banco Legado (MySQL)</span>
              <div className="flex-1 border-t border-dashed border-gray-300 dark:border-gray-600" />
            </div>
            <button
              type="button"
              onClick={gerarRelatorioMySQLPDF}
              disabled={loading || !canExport}
              className="w-full px-4 py-3 bg-purple-700 text-white rounded hover:bg-purple-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2"
              title={!canExport ? 'Sem permissão para exportar' : 'Gerar relatório direto do MySQL (BD Legado AS301)'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M12 12v5m0 0l-2-2m2 2l2-2" />
              </svg>
              PDF MySQL (Legado)
            </button>
          </div>
        </div>
      </div>

      {/* Modal CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4 text-foreground">
              ⚙️ Configuração de Exportação CSV
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-muted-foreground">Delimitador de campos</label>
                <select
                  value={csvOptions.delimiter}
                  onChange={(e) => setCsvOptions({ ...csvOptions, delimiter: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value=";">Ponto e vírgula (;) - Padrão Excel Brasil</option>
                  <option value=",">Vírgula (,) - Padrão internacional</option>
                  <option value="\t">Tabulação (Tab)</option>
                  <option value="|">Barra vertical (|)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-muted-foreground">Separador decimal</label>
                <select
                  value={csvOptions.decimalSeparator}
                  onChange={(e) => setCsvOptions({ ...csvOptions, decimalSeparator: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value=",">Vírgula (,) - Padrão brasileiro</option>
                  <option value=".">Ponto (.) - Padrão internacional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-muted-foreground">Codificação de caracteres</label>
                <select
                  value={csvOptions.encoding}
                  onChange={(e) => setCsvOptions({ ...csvOptions, encoding: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                >
                  <option value="utf-8">UTF-8 (Recomendado)</option>
                  <option value="iso-8859-1">ISO-8859-1 / Latin1 (Compatibilidade legada)</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeHeader"
                  checked={csvOptions.includeHeader}
                  onChange={(e) => setCsvOptions({ ...csvOptions, includeHeader: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeHeader" className="ml-2 text-sm font-medium text-muted-foreground">
                  Incluir linha de cabeçalho
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCSVModal(false)}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded hover:bg-gray-400 dark:hover:bg-gray-500 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={gerarRelatorioCSV}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 font-bold"
              >
                📋 Gerar CSV
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
          ℹ️ Informações do Relatório (AS301.PRG)
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Filtra sócios <strong>ativos/regulares</strong> (codTipo diferente de 3 e 4)</li>
          <li>• Mostra somente <strong>parcelas em aberto</strong> (sem baixa)</li>
          <li>• Colunas: Matrícula, Associado, Conveniado, Parcela, De, Valor, Total</li>
          <li>• Agrupa por sócio com subtotal e total geral</li>
          <li>• Filtro opcional por Convênio</li>
        </ul>
      </div>
    </div>
  );
}

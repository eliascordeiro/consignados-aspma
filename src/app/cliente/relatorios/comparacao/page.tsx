'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Convenio {
  id: number;
  codigo: string;
  razao_soc: string;
}

export default function ComparacaoRelatoriosPage() {
  const router = useRouter();
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [filtros, setFiltros] = useState({
    convenioId: '',
    convenioNome: '',
    mesAno: new Date().toISOString().slice(0, 7), // YYYY-MM
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchConvenio, setSearchConvenio] = useState('');
  const [showConvenioList, setShowConvenioList] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvSource, setCsvSource] = useState<'postgres' | 'mysql'>('postgres');
  const [csvOptions, setCsvOptions] = useState({
    delimiter: ';',
    encoding: 'utf-8',
    includeHeader: true,
    decimalSeparator: ',',
  });
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Busca convênios ao digitar
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
        }
      }
    } catch (error) {
      console.error('Erro ao carregar convênios:', error);
    }
  };

  const selecionarConvenio = (convenio: Convenio) => {
    setFiltros({
      ...filtros,
      convenioId: convenio.id.toString(),
      convenioNome: convenio.razao_soc,
    });
    setSearchConvenio(`${convenio.codigo} - ${convenio.razao_soc}`);
    setShowConvenioList(false);
    setConvenios([]);
  };

  const limparConvenio = () => {
    setFiltros({
      ...filtros,
      convenioId: '',
      convenioNome: '',
    });
    setSearchConvenio('');
    setShowConvenioList(false);
    setConvenios([]);
  };

  const sincronizarDados = async () => {
    if (!filtros.mesAno) {
      alert('Selecione o período (Mês-Ano)');
      return;
    }

    const confirmacao = confirm(
      `Deseja sincronizar os dados do MySQL para o PostgreSQL?\n\n` +
      `Período: ${filtros.mesAno}\n` +
      `${filtros.convenioId ? `Convênio: ${filtros.convenioNome}\n` : 'Todos os convênios\n'}` +
      `\nIsso irá criar/atualizar vendas e parcelas no PostgreSQL baseado nos dados do MySQL.`
    );

    if (!confirmacao) return;

    setLoading(true);
    setProgress(10);
    setSyncResult(null);

    try {
      setProgress(30);

      const response = await fetch('/api/relatorios/sincronizar-mysql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesAno: filtros.mesAno,
          ...(filtros.convenioId && { convenioId: filtros.convenioId }),
        }),
      });

      setProgress(80);

      const data = await response.json();

      if (response.ok) {
        setSyncResult(data);
        setShowSyncModal(true);
        setProgress(100);

        setTimeout(() => {
          setProgress(0);
        }, 2000);
      } else {
        alert(`Erro na sincronização: ${data.error || 'Erro desconhecido'}`);
        if (data.resultado) {
          setSyncResult(data);
          setShowSyncModal(true);
        }
        setProgress(0);
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      alert('Erro ao sincronizar dados. Verifique o console.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const gerarRelatorio = async (fonte: 'postgres' | 'mysql', formato: 'pdf' | 'excel' | 'csv') => {
    if (!filtros.mesAno) {
      alert('Selecione o período (Mês-Ano)');
      return;
    }

    setLoading(true);
    setProgress(10);

    try {
      const apiUrl = fonte === 'postgres' 
        ? '/api/relatorios/debitos-socios'
        : '/api/relatorios/debitos-mysql';

      const queryParams = new URLSearchParams({
        mesAno: filtros.mesAno,
        ...(filtros.convenioId && { convenioId: filtros.convenioId }),
        formato
      });

      // Adicionar opções CSV se for CSV
      if (formato === 'csv') {
        queryParams.append('delimiter', csvOptions.delimiter);
        queryParams.append('encoding', csvOptions.encoding);
        queryParams.append('includeHeader', csvOptions.includeHeader.toString());
        queryParams.append('decimalSeparator', csvOptions.decimalSeparator);
      }

      setProgress(30);

      const response = await fetch(`${apiUrl}?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const extensao = formato === 'pdf' ? 'pdf' : (formato === 'excel' ? 'xlsx' : 'csv');
        const prefixo = fonte === 'postgres' ? 'postgres' : 'mysql';
        a.href = url;
        a.download = `debitos-${prefixo}-${filtros.mesAno}.${extensao}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        
        setTimeout(() => {
          setProgress(0);
        }, 500);
      } else {
        const error = await response.json();
        alert(`Erro ao gerar relatório: ${error.error || 'Erro desconhecido'}`);
        setProgress(0);
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalCSV = (fonte: 'postgres' | 'mysql') => {
    setCsvSource(fonte);
    setShowCSVModal(true);
  };

  const gerarCSV = () => {
    setShowCSVModal(false);
    gerarRelatorio(csvSource, 'csv');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/cliente/relatorios"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            ← Voltar
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Comparação de Relatórios
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Compare dados entre PostgreSQL (migrado) e MySQL (original)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Filtros */}
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-md lg:col-span-2">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Convênio */}
            <div className="relative">
              <label className="block text-sm font-bold mb-2 dark:text-gray-300">
                Convênio (opcional)
              </label>
              <input
                type="text"
                value={searchConvenio}
                onChange={(e) => {
                  setSearchConvenio(e.target.value);
                  if (!e.target.value) {
                    limparConvenio();
                  }
                }}
                placeholder="Digite código ou razão social (ou deixe vazio para todos)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {filtros.convenioId && (
                <button
                  type="button"
                  onClick={limparConvenio}
                  className="absolute right-3 top-10 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Limpar seleção"
                >
                  ✕
                </button>
              )}
              {showConvenioList && convenios.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                  {convenios.map((convenio) => (
                    <div
                      key={convenio.id}
                      onClick={() => selecionarConvenio(convenio)}
                      className="p-3 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-600"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{convenio.razao_soc}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {convenio.codigo && <span>Código: {convenio.codigo}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Período */}
            <div>
              <label className="block text-sm font-bold mb-2 dark:text-gray-300">
                Período (Mês-Ano) *
              </label>
              <input
                type="month"
                value={filtros.mesAno}
                onChange={(e) => setFiltros({ ...filtros, mesAno: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Barra de Progresso */}
          {loading && (
            <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 mt-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* PostgreSQL (Migrado) */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 p-6 rounded-lg shadow-md border-2 border-blue-300 dark:border-blue-600">
          <h2 className="text-2xl font-bold mb-2 text-blue-900 dark:text-blue-300 flex items-center gap-2">
            <span>🔷</span>
            PostgreSQL
          </h2>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">Dados migrados (sistema atual)</p>

          <div className="space-y-3">
            <button
              onClick={() => gerarRelatorio('postgres', 'pdf')}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📄</span>
              PDF
            </button>

            <button
              onClick={() => gerarRelatorio('postgres', 'excel')}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📊</span>
              Excel
            </button>

            <button
              onClick={() => abrirModalCSV('postgres')}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📋</span>
              CSV
            </button>
          </div>
        </div>

        {/* MySQL (Original) */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 p-6 rounded-lg shadow-md border-2 border-orange-300 dark:border-orange-600">
          <h2 className="text-2xl font-bold mb-2 text-orange-900 dark:text-orange-300 flex items-center gap-2">
            <span>🔶</span>
            MySQL
          </h2>
          <p className="text-sm text-orange-700 dark:text-orange-400 mb-4">Dados originais (referência)</p>

          <div className="space-y-3">
            <button
              onClick={() => gerarRelatorio('mysql', 'pdf')}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📄</span>
              PDF
            </button>

            <button
              onClick={() => gerarRelatorio('mysql', 'excel')}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📊</span>
              Excel
            </button>

            <button
              onClick={() => abrirModalCSV('mysql')}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📋</span>
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Configuração CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              ⚙️ Configuração CSV - {csvSource === 'postgres' ? 'PostgreSQL' : 'MySQL'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">
                  Delimitador de campos
                </label>
                <select
                  value={csvOptions.delimiter}
                  onChange={(e) => setCsvOptions({ ...csvOptions, delimiter: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value=";">Ponto e vírgula (;) - Excel Brasil</option>
                  <option value=",">Vírgula (,) - Padrão internacional</option>
                  <option value="	">Tabulação (Tab)</option>
                  <option value="|">Barra vertical (|)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">
                  Separador decimal
                </label>
                <select
                  value={csvOptions.decimalSeparator}
                  onChange={(e) => setCsvOptions({ ...csvOptions, decimalSeparator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value=",">Vírgula (,) - Brasil</option>
                  <option value=".">Ponto (.) - Internacional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">
                  Codificação
                </label>
                <select
                  value={csvOptions.encoding}
                  onChange={(e) => setCsvOptions({ ...csvOptions, encoding: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="utf-8">UTF-8 (Recomendado)</option>
                  <option value="iso-8859-1">ISO-8859-1 (Legado)</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeHeader"
                  checked={csvOptions.includeHeader}
                  onChange={(e) => setCsvOptions({ ...csvOptions, includeHeader: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="includeHeader" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Incluir cabeçalho
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCSVModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={gerarCSV}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 font-bold"
              >
                📋 Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="mt-6 bg-yellow-50 dark:bg-gray-800 border-l-4 border-yellow-400 p-4 rounded">
        <h3 className="font-bold text-yellow-900 dark:text-yellow-300 mb-2">💡 Como usar:</h3>
        <ol className="list-decimal list-inside text-yellow-800 dark:text-yellow-400 space-y-1 text-sm">
          <li>Selecione um convênio (opcional) ou deixe vazio para todos</li>
          <li>Escolha o período (mês-ano) que deseja comparar</li>
          <li>Gere o relatório do PostgreSQL (dados migrados)</li>
          <li>Gere o relatório do MySQL (dados originais)</li>
          <li>Compare os dois arquivos para verificar se os dados estão batendo</li>
          <li><strong>Use o botão "Sincronizar" para atualizar PostgreSQL com dados do MySQL</strong></li>
        </ol>
      </div>

      {/* Modal de Resultado da Sincronização */}
      {showSyncModal && syncResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              {syncResult.success ? '✅' : '⚠️'}
              Resultado da Sincronização
            </h2>

            <div className="space-y-4">
              {/* Resumo */}
              <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-2 text-blue-900 dark:text-blue-300">Resumo</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Período:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{syncResult.periodo}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Duração:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{syncResult.duracao}</p>
                  </div>
                </div>
              </div>

              {/* Estatísticas */}
              {syncResult.resultado && (
                <div className="bg-green-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-2 text-green-900 dark:text-green-300">Dados Processados</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Vendas migradas:</span>
                      <span className="font-bold text-green-700 dark:text-green-400">
                        {syncResult.resultado.vendasMigradas}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Parcelas migradas:</span>
                      <span className="font-bold text-green-700 dark:text-green-400">
                        {syncResult.resultado.parcelasMigradas}
                      </span>
                    </div>
                    
                    {syncResult.resultado.detalhes && (
                      <>
                        <hr className="my-2 border-gray-300 dark:border-gray-600" />
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Vendas novas:</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {syncResult.resultado.detalhes.vendasNovas}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Parcelas novas:</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {syncResult.resultado.detalhes.parcelasNovas}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Parcelas atualizadas:</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {syncResult.resultado.detalhes.parcelasAtualizadas}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Erros */}
              {syncResult.resultado?.erros && syncResult.resultado.erros.length > 0 && (
                <div className="bg-red-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-2 text-red-900 dark:text-red-300">
                    Erros ({syncResult.resultado.erros.length})
                  </h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {syncResult.resultado.erros.map((erro: string, index: number) => (
                      <p key={index} className="text-sm text-red-700 dark:text-red-400">
                        • {erro}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagem de erro geral */}
              {syncResult.error && (
                <div className="bg-red-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-2 text-red-900 dark:text-red-300">❌ Erro</h3>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">{syncResult.error}</p>
                  {syncResult.details && (
                    <p className="text-xs text-red-600 dark:text-red-500 mt-2 font-mono bg-red-100 dark:bg-gray-800 p-2 rounded">
                      {syncResult.details}
                    </p>
                  )}
                  {syncResult.help && (
                    <div className="mt-3 bg-yellow-50 dark:bg-gray-800 border-l-4 border-yellow-400 p-3 rounded">
                      <p className="text-xs font-bold text-yellow-900 dark:text-yellow-300 mb-1">💡 Solução:</p>
                      <p className="text-xs text-yellow-800 dark:text-yellow-400 whitespace-pre-wrap">
                        {syncResult.help}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de fechar */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowSyncModal(false);
                    setSyncResult(null);
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

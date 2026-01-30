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

  const gerarRelatorio = async (fonte: 'postgres' | 'mysql', formato: 'pdf' | 'excel') => {
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

      setProgress(30);

      const response = await fetch(`${apiUrl}?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extensao = formato === 'pdf' ? 'pdf' : 'xlsx';
        const prefixo = fonte === 'postgres' ? 'postgres' : 'mysql';
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md lg:col-span-2">
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
              Gerar PDF (PostgreSQL)
            </button>

            <button
              onClick={() => gerarRelatorio('postgres', 'excel')}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📊</span>
              Gerar Excel (PostgreSQL)
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
              Gerar PDF (MySQL)
            </button>

            <button
              onClick={() => gerarRelatorio('mysql', 'excel')}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <span>📊</span>
              Gerar Excel (MySQL)
            </button>
          </div>
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-6 bg-yellow-50 dark:bg-gray-800 border-l-4 border-yellow-400 p-4 rounded">
        <h3 className="font-bold text-yellow-900 dark:text-yellow-300 mb-2">💡 Como usar:</h3>
        <ol className="list-decimal list-inside text-yellow-800 dark:text-yellow-400 space-y-1 text-sm">
          <li>Selecione um convênio (opcional) ou deixe vazio para todos</li>
          <li>Escolha o período (mês-ano) que deseja comparar</li>
          <li>Gere o relatório do PostgreSQL (dados migrados)</li>
          <li>Gere o relatório do MySQL (dados originais)</li>
          <li>Compare os dois arquivos para verificar se os dados estão batendo</li>
        </ol>
      </div>
    </div>
  );
}

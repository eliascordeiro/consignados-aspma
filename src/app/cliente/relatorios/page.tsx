'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Convenio {
  id: number;
  codigo: string;
  razao_soc: string;
}

export default function RelatoriosPage() {
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
        // API pode retornar { data: [], pagination: {} } ou array direto
        const conveniosData = data.data || data;
        if (Array.isArray(conveniosData)) {
          setConvenios(conveniosData);
          setShowConvenioList(true);
        } else {
          console.error('API retornou dados inválidos:', data);
          setConvenios([]);
        }
      } else {
        console.error('Erro ao carregar convênios:', response.status);
        setConvenios([]);
      }
    } catch (error) {
      console.error('Erro ao carregar convênios:', error);
      setConvenios([]);
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

  const gerarRelatorioPDF = async () => {
    if (!filtros.mesAno) {
      alert('Selecione o período (Mês-Ano)');
      return;
    }

    setLoading(true);
    setProgress(10);

    try {
      const queryParams = new URLSearchParams({
        mesAno: filtros.mesAno,
        ...(filtros.convenioId && { convenioId: filtros.convenioId }),
        formato: 'pdf'
      });

      setProgress(30);

      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debitos-socios-${filtros.mesAno}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        
        setTimeout(() => {
          setProgress(0);
          alert('Relatório PDF gerado com sucesso!');
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

  const gerarRelatorioExcel = async () => {
    if (!filtros.mesAno) {
      alert('Selecione o período (Mês-Ano)');
      return;
    }

    setLoading(true);
    setProgress(10);

    try {
      const queryParams = new URLSearchParams({
        mesAno: filtros.mesAno,
        ...(filtros.convenioId && { convenioId: filtros.convenioId }),
        formato: 'excel'
      });

      setProgress(30);

      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debitos-socios-${filtros.mesAno}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        
        setTimeout(() => {
          setProgress(0);
          alert('Relatório Excel gerado com sucesso!');
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Relatórios - Débitos de Sócios
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gere relatórios de parcelas por período
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-w-md">
        <div className="space-y-4">
          {/* Convênio (opcional) - Com busca */}
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

          {/* Período (Mês-Ano) */}
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

          {/* Barra de Progresso */}
          {loading && (
            <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={gerarRelatorioPDF}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
            >
              📄 PDF
            </button>
            <button
              type="button"
              onClick={gerarRelatorioExcel}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
            >
              📊 Excel
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
          ℹ️ Informações do Relatório
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Lista todas as parcelas do período selecionado</li>
          <li>• Agrupa por associado (matrícula)</li>
          <li>• Mostra total por associado e total geral</li>
          <li>• Indica parcelas pagas com "OK"</li>
        </ul>
      </div>
    </div>
  );
}

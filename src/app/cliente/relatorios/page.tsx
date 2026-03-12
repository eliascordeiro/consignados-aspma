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

interface Socio {
  id: number;
  matricula: string;
  nome: string;
}

type TipoRelatorio = 'socios' | 'pensionistas' | 'comparacao' | null;

export default function RelatoriosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canExport = hasPermission(userPermissions, 'relatorios.export');

  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>(null);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [filtros, setFiltros] = useState({
    convenioId: '',
    convenioNome: '',
    socioMatricula: '',
    socioNome: '',
    mesAno: new Date().toISOString().slice(0, 7), // YYYY-MM
    agrupaPor: 'socio', // 'socio' ou 'convenio'
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchConvenio, setSearchConvenio] = useState('');
  const [showConvenioList, setShowConvenioList] = useState(false);
  const [searchSocio, setSearchSocio] = useState('');
  const [showSocioList, setShowSocioList] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvOptions, setCsvOptions] = useState({
    delimiter: ';',
    encoding: 'utf-8',
    includeHeader: true,
    decimalSeparator: ',',
  });

  // Busca convênios ao digitar
  useEffect(() => {
    if (searchConvenio.length >= 2 && !filtros.convenioId) {
      carregarConvenios();
    } else if (searchConvenio.length < 2) {
      setShowConvenioList(false);
    }
  }, [searchConvenio]);

  // Busca sócios ao digitar
  useEffect(() => {
    if (searchSocio.length >= 2 && !filtros.socioMatricula) {
      carregarSocios();
    } else if (searchSocio.length < 2) {
      setShowSocioList(false);
    }
  }, [searchSocio]);

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

  const carregarSocios = async () => {
    try {
      const response = await fetch(`/api/socios?search=${searchSocio}`);
      if (response.ok) {
        const data = await response.json();
        const sociosData = data.data || data;
        if (Array.isArray(sociosData)) {
          setSocios(sociosData);
          setShowSocioList(true);
        } else {
          console.error('API retornou dados inválidos:', data);
          setSocios([]);
        }
      } else {
        console.error('Erro ao carregar sócios:', response.status);
        setSocios([]);
      }
    } catch (error) {
      console.error('Erro ao carregar sócios:', error);
      setSocios([]);
    }
  };

  const selecionarSocio = (socio: Socio) => {
    setFiltros({
      ...filtros,
      socioMatricula: socio.matricula,
      socioNome: socio.nome,
    });
    setSearchSocio(`${socio.matricula} - ${socio.nome}`);
    setShowSocioList(false);
    setSocios([]);
  };

  const limparSocio = () => {
    setFiltros({
      ...filtros,
      socioMatricula: '',
      socioNome: '',
    });
    setSearchSocio('');
    setShowSocioList(false);
    setSocios([]);
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
        ...(filtros.socioMatricula && { socioMatricula: filtros.socioMatricula }),
        agrupaPor: filtros.agrupaPor,
        formato: 'pdf',
        // Adiciona parâmetros específicos para pensionistas
        ...(tipoRelatorio === 'pensionistas' && { 
          tipoSocio: 'pensionistas',
          apenasEmAberto: 'true' 
        }),
      });

      setProgress(30);

      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const nomeArquivo = tipoRelatorio === 'pensionistas' 
          ? `debitos-pensionistas-${filtros.mesAno}.pdf`
          : `debitos-socios-${filtros.mesAno}.pdf`;
        a.download = nomeArquivo;
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
        ...(filtros.socioMatricula && { socioMatricula: filtros.socioMatricula }),
        agrupaPor: filtros.agrupaPor,
        formato: 'excel',
        // Adiciona parâmetros específicos para pensionistas
        ...(tipoRelatorio === 'pensionistas' && { 
          tipoSocio: 'pensionistas',
          apenasEmAberto: 'true' 
        }),
      });

      setProgress(30);

      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const nomeArquivo = tipoRelatorio === 'pensionistas' 
          ? `debitos-pensionistas-${filtros.mesAno}.xlsx`
          : `debitos-socios-${filtros.mesAno}.xlsx`;
        a.download = nomeArquivo;
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

  const gerarRelatorioCSV = async () => {
    if (!filtros.mesAno) {
      alert('Selecione o período (Mês-Ano)');
      return;
    }

    setLoading(true);
    setProgress(10);
    setShowCSVModal(false);

    try {
      const queryParams = new URLSearchParams({
        mesAno: filtros.mesAno,
        ...(filtros.convenioId && { convenioId: filtros.convenioId }),
        ...(filtros.socioMatricula && { socioMatricula: filtros.socioMatricula }),
        agrupaPor: filtros.agrupaPor,
        formato: 'csv',
        delimiter: csvOptions.delimiter,
        encoding: csvOptions.encoding,
        includeHeader: csvOptions.includeHeader.toString(),
        decimalSeparator: csvOptions.decimalSeparator,
        // Adiciona parâmetros específicos para pensionistas
        ...(tipoRelatorio === 'pensionistas' && { 
          tipoSocio: 'pensionistas',
          apenasEmAberto: 'true' 
        }),
      });

      setProgress(30);

      const response = await fetch(`/api/relatorios/debitos-socios?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const nomeArquivo = tipoRelatorio === 'pensionistas' 
          ? `debitos-pensionistas-${filtros.mesAno}.csv`
          : `debitos-socios-${filtros.mesAno}.csv`;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        
        setTimeout(() => {
          setProgress(0);
          alert('Relatório CSV gerado com sucesso!');
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

  const gerarRelatorioPensionistaMySQL = async () => {
    if (!filtros.mesAno) {
      alert('Selecione o período (Mês-Ano)');
      return;
    }

    if (tipoRelatorio !== 'pensionistas') {
      alert('Esta função é exclusiva para relatório de Pensionistas');
      return;
    }

    setLoading(true);
    setProgress(10);

    try {
      const queryParams = new URLSearchParams({
        mesAno: filtros.mesAno,
        ...(filtros.convenioId && { convenioId: filtros.convenioId }),
        formato: 'pdf',
      });

      setProgress(30);

      const response = await fetch(`/api/relatorios/pensionistas-mysql?${queryParams}`);
      
      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pensionistas-mysql-${filtros.mesAno}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);
        
        setTimeout(() => {
          setProgress(0);
          alert('Relatório MySQL gerado com sucesso!');
        }, 500);
      } else {
        const error = await response.json();
        alert(`Erro ao gerar relatório: ${error.error || 'Erro desconhecido'}`);
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

  const gerarRelatorioSociosMySQL = async () => {
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
        formato: 'pdf',
      });

      setProgress(30);

      const response = await fetch(`/api/relatorios/debitos-mysql?${queryParams}`);

      setProgress(60);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debitos-socios-mysql-${filtros.mesAno}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setProgress(100);

        setTimeout(() => {
          setProgress(0);
          alert('Relatório MySQL (BD Legado) gerado com sucesso!');
        }, 500);
      } else {
        const error = await response.json();
        alert(`Erro ao gerar relatório: ${error.error || 'Erro desconhecido'}`);
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
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Central de Relatórios
            </h1>
            <p className="text-sm text-muted-foreground">
              Gere e exporte relatórios de débitos e parcelas
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Relatórios Disponíveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Card Débitos de Sócios */}
        <div 
          onClick={() => setTipoRelatorio('socios')}
          className={`relative cursor-pointer rounded-xl p-5 shadow-lg transition-all duration-200 ${
            tipoRelatorio === 'socios'
              ? 'bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 text-white ring-2 ring-blue-400/50'
              : 'bg-card text-card-foreground border border-border hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500'
          }`}
        >
          {tipoRelatorio === 'socios' && (
            <div className="absolute top-3 right-3">
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">Ativo</span>
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${
              tipoRelatorio === 'socios'
                ? 'bg-white/20'
                : 'bg-blue-100 dark:bg-blue-900/50'
            }`}>
              <svg className={`w-6 h-6 ${tipoRelatorio === 'socios' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className={`font-bold text-lg ${tipoRelatorio === 'socios' ? 'text-white' : 'text-foreground'}`}>
              Débitos de Sócios
            </h3>
          </div>
          <p className={`text-sm leading-relaxed ${
            tipoRelatorio === 'socios'
              ? 'text-blue-100'
              : 'text-muted-foreground'
          }`}>
            Parcelas por período com agrupamento por sócio ou convênio. PDF, Excel e CSV.
          </p>
        </div>

        {/* Card Débitos Pensionistas */}
        <div
          onClick={() => setTipoRelatorio('pensionistas')}
          className={`relative cursor-pointer rounded-xl p-5 shadow-lg transition-all duration-200 ${
            tipoRelatorio === 'pensionistas'
              ? 'bg-gradient-to-br from-amber-500 to-amber-700 dark:from-amber-600 dark:to-amber-800 text-white ring-2 ring-amber-400/50'
              : 'bg-card text-card-foreground border border-border hover:shadow-xl hover:border-amber-400 dark:hover:border-amber-500'
          }`}
        >
          {tipoRelatorio === 'pensionistas' && (
            <div className="absolute top-3 right-3">
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">Ativo</span>
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${
              tipoRelatorio === 'pensionistas'
                ? 'bg-white/20'
                : 'bg-amber-100 dark:bg-amber-900/50'
            }`}>
              <svg className={`w-6 h-6 ${tipoRelatorio === 'pensionistas' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h3 className={`font-bold text-lg ${tipoRelatorio === 'pensionistas' ? 'text-white' : 'text-foreground'}`}>
              Débitos Pensionistas
            </h3>
          </div>
          <p className={`text-sm leading-relaxed ${
            tipoRelatorio === 'pensionistas'
              ? 'text-amber-100'
              : 'text-muted-foreground'
          }`}>
            Parcelas em aberto de sócios tipo Pensionista/Local (Tipo 3 e 4). Baseado no AS302.
          </p>
        </div>

        {/* Card Débitos de Ativos (AS301) */}
        <Link href="/cliente/relatorios/ativos">
          <div
            className="relative cursor-pointer rounded-xl p-5 shadow-lg transition-all duration-200 bg-card text-card-foreground border border-border hover:shadow-xl hover:border-green-400 dark:hover:border-green-500"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-foreground">
                Débitos de Associados
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Parcelas em aberto de sócios ativos/regulares (Tipo ≠ 3 e 4). Baseado no AS301.
            </p>
          </div>
        </Link>

        {/* Card Comparação */}
        <Link href="/cliente/relatorios/comparacao">
          <div
            className="relative cursor-pointer rounded-xl p-5 shadow-lg transition-all duration-200 bg-card text-card-foreground border border-border hover:shadow-xl hover:border-purple-400 dark:hover:border-purple-500"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-foreground">
                Comparar Bases
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Compare dados entre PostgreSQL e MySQL para auditoria e validação.
            </p>
          </div>
        </Link>
      </div>

      {/* Formulário Principal - Exibe apenas se um tipo de relatório for selecionado */}
      {tipoRelatorio && tipoRelatorio !== 'comparacao' && (
        <div className="bg-card text-card-foreground rounded-xl shadow-md border border-border overflow-hidden">
          {/* Header do formulário */}
          <div className="px-6 py-4 bg-muted/30/80 border-b border-border">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros do Relatório {tipoRelatorio === 'pensionistas' && '- Pensionistas'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {tipoRelatorio === 'pensionistas' 
                ? 'Filtros para parcelas em aberto de pensionistas (Tipo 3 e 4)'
                : 'Configure os filtros e escolha o formato de exportação'
              }
            </p>
          </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna Esquerda - Filtros */}
            <div className="space-y-5">
              {/* Período e Agrupamento lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-muted-foreground">
                    Período *
                  </label>
                  <input
                    type="month"
                    value={filtros.mesAno}
                    onChange={(e) => setFiltros({ ...filtros, mesAno: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-muted-foreground">
                    Agrupar por *
                  </label>
                  <select
                    value={filtros.agrupaPor}
                    onChange={(e) => setFiltros({ ...filtros, agrupaPor: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  >
                    <option value="socio">Sócio</option>
                    <option value="convenio">Convênio</option>
                  </select>
                </div>
              </div>

              {/* Sócio - Não exibe para relatório de pensionistas */}
              {tipoRelatorio !== 'pensionistas' && (
                <div className="relative">
                  <label className="block text-sm font-semibold mb-1.5 text-muted-foreground">
                    Sócio
                    <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchSocio}
                      onChange={(e) => {
                        setSearchSocio(e.target.value);
                        if (!e.target.value) {
                          limparSocio();
                        }
                      }}
                      placeholder="Buscar por matrícula ou nome..."
                      className="w-full px-3 py-2.5 pr-9 border border-border rounded-lg bg-background text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    />
                    {filtros.socioMatricula ? (
                      <button
                        type="button"
                        onClick={limparSocio}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Limpar seleção"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : (
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </div>
                  {showSocioList && socios.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {socios.map((socio) => (
                        <div
                          key={socio.id}
                          onClick={() => selecionarSocio(socio)}
                          className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer border-b border-border last:border-b-0 transition-colors"
                        >
                          <div className="font-semibold text-foreground text-sm">{socio.nome}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {socio.matricula && <span>Matrícula: {socio.matricula}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Convênio */}
              <div className="relative">
                <label className="block text-sm font-semibold mb-1.5 text-muted-foreground">
                  Convênio
                  <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchConvenio}
                    onChange={(e) => {
                      setSearchConvenio(e.target.value);
                      if (!e.target.value) {
                        limparConvenio();
                      }
                    }}
                    placeholder="Buscar por código ou razão social..."
                    className="w-full px-3 py-2.5 pr-9 border border-border rounded-lg bg-background text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                  {filtros.convenioId ? (
                    <button
                      type="button"
                      onClick={limparConvenio}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Limpar seleção"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
                {showConvenioList && convenios.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {convenios.map((convenio) => (
                      <div
                        key={convenio.id}
                        onClick={() => selecionarConvenio(convenio)}
                        className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-foreground text-sm">{convenio.razao_soc}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {convenio.codigo && <span>Código: {convenio.codigo}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Coluna Direita - Exportação */}
            <div className="lg:border-l lg:border-gray-200 dark:lg:border-gray-700 lg:pl-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar Relatório
              </h3>

              <div className="space-y-3">
                {/* Botão PDF */}
                <button
                  type="button"
                  onClick={gerarRelatorioPDF}
                  disabled={loading || !canExport}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-background border-2 border-border rounded-lg hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                  title={!canExport ? 'Sem permissão para exportar' : 'Gerar relatório em PDF'}
                >
                  <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-800/40 transition-colors">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-foreground text-sm">PDF</div>
                    <div className="text-xs text-muted-foreground">Documento para impressão</div>
                  </div>
                </button>

                {/* Botão Excel */}
                <button
                  type="button"
                  onClick={gerarRelatorioExcel}
                  disabled={loading || !canExport}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-background border-2 border-border rounded-lg hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                  title={!canExport ? 'Sem permissão para exportar' : 'Gerar relatório em Excel'}
                >
                  <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-foreground text-sm">Excel</div>
                    <div className="text-xs text-muted-foreground">Planilha editável (.xlsx)</div>
                  </div>
                </button>

                {/* Botão CSV */}
                <button
                  type="button"
                  onClick={() => setShowCSVModal(true)}
                  disabled={loading || !canExport}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-background border-2 border-border rounded-lg hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                  title={!canExport ? 'Sem permissão para exportar' : 'Gerar relatório em CSV'}
                >
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40 transition-colors">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-foreground text-sm">CSV</div>
                    <div className="text-xs text-muted-foreground">Dados delimitados (configurável)</div>
                  </div>
                </button>

                {/* Botão MySQL - Apenas para Sócios */}
                {tipoRelatorio === 'socios' && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-card text-card-foreground text-muted-foreground font-medium">
                          Banco Legado (MySQL)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={gerarRelatorioSociosMySQL}
                      disabled={loading || !canExport}
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-background border-2 border-border rounded-lg hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                      title={!canExport ? 'Sem permissão para exportar' : 'Gerar relatório do MySQL (BD Legado)'}
                    >
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          PDF MySQL
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded font-semibold">AS200</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Dados do banco legado</div>
                      </div>
                    </button>
                  </>
                )}

                {/* Botão MySQL - Apenas para Pensionistas */}
                {tipoRelatorio === 'pensionistas' && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-card text-card-foreground text-muted-foreground font-medium">
                          Banco Legado (MySQL)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={gerarRelatorioPensionistaMySQL}
                      disabled={loading || !canExport}
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-background border-2 border-border rounded-lg hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                      title={!canExport ? 'Sem permissão para exportar' : 'Gerar relatório do MySQL (AS302.PRG)'}
                    >
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          PDF MySQL
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded font-semibold">AS302</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Dados do banco legado</div>
                      </div>
                    </button>
                  </>
                )}
              </div>

              {/* Barra de Progresso */}
              {loading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Gerando relatório...</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Info resumo */}
              <div className="mt-5 p-3 bg-muted/50/50 rounded-lg">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  O que o relatório inclui
                </h4>
                {tipoRelatorio === 'pensionistas' ? (
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Apenas sócios Tipo 3 e 4 (Pensionistas/Locais)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Somente parcelas em aberto (sem baixa)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Agrupamento por sócio ou convênio
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Baseado no relatório AS302 (Harbour)
                    </li>
                  </ul>
                ) : (
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Todas as parcelas do período selecionado
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Agrupamento por sócio ou convênio
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Subtotais por grupo e total geral
                    </li>
                    <li className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Indicação de parcelas pagas (OK)
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}



      {/* Modal de Configuração CSV */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configuração CSV
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-muted-foreground">
                  Delimitador de campos
                </label>
                <select
                  value={csvOptions.delimiter}
                  onChange={(e) => setCsvOptions({ ...csvOptions, delimiter: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value=";">Ponto e vírgula (;) - Padrão Excel Brasil</option>
                  <option value=",">Vírgula (,) - Padrão internacional</option>
                  <option value="	">Tabulação (Tab)</option>
                  <option value="|">Barra vertical (|)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-muted-foreground">
                  Separador decimal
                </label>
                <select
                  value={csvOptions.decimalSeparator}
                  onChange={(e) => setCsvOptions({ ...csvOptions, decimalSeparator: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value=",">Vírgula (,) - Padrão brasileiro</option>
                  <option value=".">Ponto (.) - Padrão internacional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-muted-foreground">
                  Codificação de caracteres
                </label>
                <select
                  value={csvOptions.encoding}
                  onChange={(e) => setCsvOptions({ ...csvOptions, encoding: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="utf-8">UTF-8 (Recomendado)</option>
                  <option value="iso-8859-1">ISO-8859-1 / Latin1</option>
                </select>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/50/50 rounded-lg">
                <input
                  type="checkbox"
                  id="includeHeader"
                  checked={csvOptions.includeHeader}
                  onChange={(e) => setCsvOptions({ ...csvOptions, includeHeader: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                />
                <label htmlFor="includeHeader" className="text-sm font-medium text-muted-foreground">
                  Incluir linha de cabeçalho
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-muted/30/80 border-t border-border flex gap-3">
              <button
                onClick={() => setShowCSVModal(false)}
                className="flex-1 px-4 py-2.5 bg-background text-foreground border border-border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={gerarRelatorioCSV}
                className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Gerar CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

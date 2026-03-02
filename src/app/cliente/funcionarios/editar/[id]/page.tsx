'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/config/permissions';
import { formatarCelular } from '@/lib/utils';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface Empresa { id: number; nome: string }
interface Classe { id: number; classe: string }
interface Setor { id: number; codigo: string; setores: string | null }

type Tab = 'pessoais' | 'profissionais' | 'financeiros' | 'outros';

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  return new Date(dateString).toISOString().split('T')[0];
};

export default function EditarFuncionarioPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const userPermissions = (session?.user as any)?.permissions || [];
  const canEdit = hasPermission(userPermissions, 'funcionarios.edit');
  const canView = hasPermission(userPermissions, 'funcionarios.view');

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('pessoais');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);

  const [formData, setFormData] = useState({
    nome: '', cpf: '', rg: '', matricula: '', empresaId: '',
    funcao: '', lotacao: '', endereco: '', bairro: '', cep: '',
    cidade: '', uf: '', telefone: '', celular: '', email: '',
    contato: '', dataCadastro: '', dataAdmissao: '', dataNascimento: '',
    limite: '', gratificacao: '', autorizado: '', sexo: '', estadoCivil: '',
    numCompras: '', tipo: '', agencia: '', conta: '', banco: '',
    devolucao: '', bloqueio: 'N', motivoBloqueio: '', codTipo: '',
    senha: '', dataExclusao: '', motivoExclusao: '', ativo: true,
  });

  const set = (field: string, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    Promise.all([
      fetch('/api/consignatarias?limit=1000').then(r => r.ok ? r.json() : null),
      fetch('/api/classes').then(r => r.ok ? r.json() : null),
      fetch('/api/setores').then(r => r.ok ? r.json() : null),
    ]).then(([empresasData, classesData, setoresData]) => {
      if (empresasData) setEmpresas(empresasData.data || empresasData);
      if (classesData) setClasses(classesData);
      if (setoresData) setSetores(setoresData);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    const loadFuncionario = async () => {
      setLoadingData(true);
      try {
        const response = await fetch(`/api/funcionarios/${id}`);
        if (!response.ok) throw new Error('Sócio não encontrado');
        const data = await response.json();

        // Buscar margem consignada
        let limiteCalculado = data.limite?.toString() || '';
        try {
          const margemResponse = await fetch(`/api/socios/${id}/margem`);
          if (margemResponse.ok) {
            const margemData = await margemResponse.json();
            const valorMargem = margemData.margem || margemData.limite || 0;
            limiteCalculado = Number(valorMargem).toFixed(2);
          }
        } catch {
          // Usa o limite do banco se a API de margem falhar
        }

        setFormData({
          nome: data.nome || '',
          cpf: data.cpf || '',
          rg: data.rg || '',
          matricula: data.matricula || '',
          empresaId: data.empresaId?.toString() || '',
          funcao: data.funcao || '',
          lotacao: data.lotacao || '',
          endereco: data.endereco || '',
          bairro: data.bairro || '',
          cep: data.cep || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          telefone: data.telefone || '',
          celular: formatarCelular(data.celular || ''),  // formata ao carregar
          email: data.email || '',
          contato: data.contato || '',
          dataCadastro: formatDate(data.dataCadastro),
          dataAdmissao: formatDate(data.dataAdmissao),
          dataNascimento: formatDate(data.dataNascimento),
          limite: limiteCalculado,
          gratificacao: data.gratificacao?.toString() || '',
          autorizado: data.autorizado || '',
          sexo: data.sexo || '',
          estadoCivil: data.estadoCivil || '',
          numCompras: data.numCompras?.toString() || '',
          tipo: data.tipo || '',
          agencia: data.agencia || '',
          conta: data.conta || '',
          banco: data.banco || '',
          devolucao: data.devolucao?.toString() || '',
          bloqueio: data.bloqueio || 'N',
          motivoBloqueio: data.motivoBloqueio || '',
          codTipo: data.codTipo?.toString() || '',
          senha: data.senha || '',
          dataExclusao: formatDate(data.dataExclusao),
          motivoExclusao: data.motivoExclusao || '',
          ativo: data.ativo ?? true,
        });
      } catch {
        alert('Erro ao carregar dados do sócio');
        router.push('/cliente/funcionarios');
      } finally {
        setLoadingData(false);
      }
    };
    loadFuncionario();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/funcionarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar sócio');
        return;
      }
      router.push('/cliente/funcionarios');
    } catch {
      alert('Erro ao salvar sócio');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit && !canView) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-red-500">Sem permissão para editar sócios.</p>
      </div>
    );
  }

  const inputCls = 'w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500';
  const selectCls = inputCls;
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';
  const disabledCls = `${inputCls} bg-muted cursor-not-allowed`;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'pessoais', label: 'Pessoais' },
    { id: 'profissionais', label: 'Profissionais' },
    { id: 'financeiros', label: 'Financeiros' },
    { id: 'outros', label: 'Outros' },
  ];

  if (loadingData) {
    return (
      <div className="container mx-auto p-6 text-center py-12 text-gray-500">
        Carregando dados...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link href="/cliente/funcionarios" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-muted-foreground dark:hover:text-gray-100 mb-4 transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Voltar para Sócios
      </Link>

      <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">Editar Sócio</h1>
          {formData.nome && (
            <p className="text-sm text-muted-foreground mt-1">{formData.nome}</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="border-b border-border px-6">
            <div className="flex gap-0 -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-muted-foreground hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* ---- TAB PESSOAIS ---- */}
            {activeTab === 'pessoais' && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Consignatária</label>
                  <select value={formData.empresaId} onChange={(e) => set('empresaId', e.target.value)} disabled={!canEdit} className={canEdit ? selectCls : disabledCls}>
                    <option value="">Nenhuma</option>
                    {empresas.map((e) => <option key={e.id} value={e.id.toString()}>{e.nome}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Matrícula *</label>
                    <input required value={formData.matricula} onChange={(e) => set('matricula', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Nome Completo *</label>
                    <input required value={formData.nome} onChange={(e) => set('nome', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>CPF</label>
                    <input value={formData.cpf} onChange={(e) => set('cpf', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>RG</label>
                    <input value={formData.rg} onChange={(e) => set('rg', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Data de Nascimento</label>
                    <input type="date" value={formData.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Sexo</label>
                    <select value={formData.sexo} onChange={(e) => set('sexo', e.target.value)} disabled={!canEdit} className={canEdit ? selectCls : disabledCls}>
                      <option value="">Selecione</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Estado Civil</label>
                    <select value={formData.estadoCivil} onChange={(e) => set('estadoCivil', e.target.value)} disabled={!canEdit} className={canEdit ? selectCls : disabledCls}>
                      <option value="">Selecione</option>
                      <option value="S">Solteiro(a)</option>
                      <option value="C">Casado(a)</option>
                      <option value="D">Divorciado(a)</option>
                      <option value="V">Viúvo(a)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Telefone</label>
                    <input value={formData.telefone} onChange={(e) => set('telefone', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Celular</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={15}
                      placeholder="(41) 99999-9999"
                      value={formData.celular}
                      onChange={(e) => set('celular', formatarCelular(e.target.value))}
                      disabled={!canEdit}
                      className={canEdit ? inputCls : disabledCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>CEP</label>
                    <input value={formData.cep} onChange={(e) => set('cep', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Endereço</label>
                    <input value={formData.endereco} onChange={(e) => set('endereco', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Bairro</label>
                    <input value={formData.bairro} onChange={(e) => set('bairro', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Cidade</label>
                    <input value={formData.cidade} onChange={(e) => set('cidade', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>UF</label>
                    <input value={formData.uf} onChange={(e) => set('uf', e.target.value)} maxLength={2} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>
              </div>
            )}

            {/* ---- TAB PROFISSIONAIS ---- */}
            {activeTab === 'profissionais' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Função</label>
                    <input value={formData.funcao} onChange={(e) => set('funcao', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Lotação/Setor</label>
                    <input value={formData.lotacao} onChange={(e) => set('lotacao', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Data de Cadastro</label>
                    <input type="date" value={formData.dataCadastro} onChange={(e) => set('dataCadastro', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Data de Admissão</label>
                    <input type="date" value={formData.dataAdmissao} onChange={(e) => set('dataAdmissao', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Contato Adicional</label>
                  <input value={formData.contato} onChange={(e) => set('contato', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                </div>

                <div>
                  <label className={labelCls}>Pessoa Autorizada</label>
                  <input value={formData.autorizado} onChange={(e) => set('autorizado', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                </div>
              </div>
            )}

            {/* ---- TAB FINANCEIROS ---- */}
            {activeTab === 'financeiros' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Margem Consignada
                      <span className="ml-1 text-xs text-gray-400">(calculado automaticamente)</span>
                    </label>
                    <input type="number" step="0.01" value={formData.limite} disabled className={disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Gratificação</label>
                    <input type="number" step="0.01" value={formData.gratificacao} onChange={(e) => set('gratificacao', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Banco</label>
                    <input value={formData.banco} onChange={(e) => set('banco', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Agência</label>
                    <input value={formData.agencia} onChange={(e) => set('agencia', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Conta</label>
                    <input value={formData.conta} onChange={(e) => set('conta', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Número de Compras</label>
                    <input type="number" value={formData.numCompras} onChange={(e) => set('numCompras', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Devolução</label>
                    <input type="number" step="0.01" value={formData.devolucao} onChange={(e) => set('devolucao', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                </div>
              </div>
            )}

            {/* ---- TAB OUTROS ---- */}
            {activeTab === 'outros' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Bloqueio</label>
                    <select value={formData.bloqueio} onChange={(e) => set('bloqueio', e.target.value)} disabled={!canEdit} className={canEdit ? selectCls : disabledCls}>
                      <option value="N">Sem bloqueio</option>
                      <option value="X">Bloqueado</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo (Classe)</label>
                    <select value={formData.tipo} onChange={(e) => set('tipo', e.target.value)} disabled={!canEdit} className={canEdit ? selectCls : disabledCls}>
                      <option value="">Selecione a classe</option>
                      {classes.map((c) => <option key={c.id} value={c.id.toString()}>{c.classe}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Motivo do Bloqueio</label>
                  <input value={formData.motivoBloqueio} onChange={(e) => set('motivoBloqueio', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Data de Exclusão</label>
                    <input type="date" value={formData.dataExclusao} onChange={(e) => set('dataExclusao', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Setor</label>
                    <select value={formData.codTipo} onChange={(e) => set('codTipo', e.target.value)} disabled={!canEdit} className={canEdit ? selectCls : disabledCls}>
                      <option value="">Selecione o setor</option>
                      {setores.map((s) => <option key={s.id} value={s.codigo}>{s.setores || s.codigo}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Motivo da Exclusão</label>
                  <input value={formData.motivoExclusao} onChange={(e) => set('motivoExclusao', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Senha</label>
                    <input value={formData.senha} onChange={(e) => set('senha', e.target.value)} disabled={!canEdit} className={canEdit ? inputCls : disabledCls} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="ativo"
                      checked={formData.ativo}
                      onChange={(e) => set('ativo', e.target.checked)}
                      disabled={!canEdit}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="ativo" className="text-sm text-muted-foreground cursor-pointer">Ativo</label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <Link
              href="/cliente/funcionarios"
              className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancelar
            </Link>
            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

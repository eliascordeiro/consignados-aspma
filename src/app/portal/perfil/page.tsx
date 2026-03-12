'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Perfil {
  nome: string
  cpf: string | null
  rg: string | null
  matricula: string | null
  funcao: string | null
  lotacao: string | null
  endereco: string | null
  bairro: string | null
  cep: string | null
  cidade: string | null
  uf: string | null
  telefone: string | null
  celular: string | null
  email: string | null
  dataAdmissao: string | null
  dataNascimento: string | null
  sexo: string | null
  estadoCivil: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo: string | null
  empresa: { nome: string } | null
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('pt-BR')
}

function maskCpf(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function Campo({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || '—'}</p>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
      <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100">
        <h2 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">{titulo}</h2>
      </div>
      <div className="px-4 divide-y divide-gray-50">
        {children}
      </div>
    </div>
  )
}

export default function PortalPerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/portal/perfil')
      .then(r => {
        if (r.status === 401) { router.push('/portal/login'); return null }
        return r.json()
      })
      .then(data => { if (data) setPerfil(data) })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!perfil) return null

  return (
    <div className="px-4 py-6">
      {/* Avatar / Nome */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-800 text-center leading-tight">{perfil.nome}</h1>
        {perfil.matricula && (
          <p className="text-sm text-gray-500 mt-0.5">Matrícula: {perfil.matricula}</p>
        )}
        {perfil.empresa && (
          <p className="text-xs text-emerald-600 mt-1 font-medium">{perfil.empresa.nome}</p>
        )}
      </div>

      {/* Dados Pessoais */}
      <Secao titulo="Dados Pessoais">
        <Campo label="CPF" value={maskCpf(perfil.cpf)} />
        <Campo label="RG" value={perfil.rg} />
        <Campo label="Data de Nascimento" value={formatDate(perfil.dataNascimento)} />
        <Campo label="Sexo" value={perfil.sexo} />
        <Campo label="Estado Civil" value={perfil.estadoCivil} />
      </Secao>

      {/* Dados Funcionais */}
      <Secao titulo="Dados Funcionais">
        <Campo label="Função" value={perfil.funcao} />
        <Campo label="Lotação" value={perfil.lotacao} />
        <Campo label="Tipo" value={perfil.tipo} />
        <Campo label="Data de Admissão" value={formatDate(perfil.dataAdmissao)} />
      </Secao>

      {/* Contato */}
      <Secao titulo="Contato">
        <Campo label="Telefone" value={perfil.telefone} />
        <Campo label="Celular" value={perfil.celular} />
        <Campo label="E-mail" value={perfil.email} />
      </Secao>

      {/* Endereço */}
      <Secao titulo="Endereço">
        <Campo label="Endereço" value={perfil.endereco} />
        <Campo label="Bairro" value={perfil.bairro} />
        <Campo label="CEP" value={perfil.cep} />
        <Campo
          label="Cidade / UF"
          value={perfil.cidade && perfil.uf ? `${perfil.cidade} / ${perfil.uf}` : perfil.cidade || perfil.uf}
        />
      </Secao>

      {/* Dados Bancários */}
      <Secao titulo="Dados Bancários">
        <Campo label="Banco" value={perfil.banco} />
        <Campo label="Agência" value={perfil.agencia} />
        <Campo label="Conta" value={perfil.conta} />
      </Secao>

      {/* Aviso */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex gap-3 items-start mt-2 mb-6">
        <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-xs text-amber-700 leading-relaxed">
          Para atualizar seus dados, entre em contato com o setor administrativo da ASPMA.
        </p>
      </div>
    </div>
  )
}

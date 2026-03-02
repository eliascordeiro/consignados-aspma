'use client'

import { useEffect, useState } from 'react'

interface Socio {
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
  agencia: string | null
  conta: string | null
  banco: string | null
  empresa: { nome: string } | null
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('pt-BR')
}

function maskCPF(cpf: string | null) {
  if (!cpf) return null
  const n = cpf.replace(/\D/g, '')
  if (n.length !== 11) return cpf
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.***-**`
}

interface InfoRowProps {
  label: string
  value: string | null | undefined
}

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-50 last:border-0">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-gray-800 text-sm font-medium">{value}</p>
    </div>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <span className="text-emerald-600">{icon}</span>
        <h2 className="text-gray-700 text-sm font-semibold uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

export default function DadosPage() {
  const [socio, setSocio] = useState<Socio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/me')
      .then(r => r.json())
      .then(data => setSocio(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    )
  }

  if (!socio) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Erro ao carregar dados</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Avatar e nome */}
      <div className="flex flex-col items-center py-4">
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-md">
          <span className="text-white text-3xl font-bold">
            {socio.nome.charAt(0).toUpperCase()}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mt-3 text-center">{socio.nome}</h1>
        {socio.matricula && (
          <p className="text-gray-400 text-sm mt-0.5">Matrícula: {socio.matricula}</p>
        )}
        {socio.empresa && (
          <p className="text-emerald-600 text-xs font-medium mt-1">{socio.empresa.nome}</p>
        )}
      </div>

      {/* Dados pessoais */}
      <Section
        title="Dados Pessoais"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        }
      >
        <InfoRow label="CPF" value={maskCPF(socio.cpf)} />
        <InfoRow label="RG" value={socio.rg} />
        <InfoRow label="Data de Nascimento" value={formatDate(socio.dataNascimento)} />
        <InfoRow label="Função" value={socio.funcao} />
        <InfoRow label="Lotação" value={socio.lotacao} />
        <InfoRow label="Data de Admissão" value={formatDate(socio.dataAdmissao)} />
      </Section>

      {/* Contato */}
      <Section
        title="Contato"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        }
      >
        <InfoRow label="E-mail" value={socio.email} />
        <InfoRow label="Celular" value={socio.celular} />
        <InfoRow label="Telefone" value={socio.telefone} />
      </Section>

      {/* Endereço */}
      {(socio.endereco || socio.bairro || socio.cidade) && (
        <Section
          title="Endereço"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          <InfoRow label="Endereço" value={socio.endereco} />
          <InfoRow label="Bairro" value={socio.bairro} />
          <InfoRow label="CEP" value={socio.cep} />
          <InfoRow label="Cidade/UF" value={[socio.cidade, socio.uf].filter(Boolean).join(' - ') || null} />
        </Section>
      )}

      {/* Dados bancários */}
      {(socio.banco || socio.agencia || socio.conta) && (
        <Section
          title="Dados Bancários"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          }
        >
          <InfoRow label="Banco" value={socio.banco} />
          <InfoRow label="Agência" value={socio.agencia} />
          <InfoRow label="Conta" value={socio.conta} />
        </Section>
      )}

      {/* Aviso */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-amber-800 text-xs text-center">
          Para atualizar seus dados cadastrais, entre em contato com a secretaria da ASPMA.
        </p>
      </div>
    </div>
  )
}

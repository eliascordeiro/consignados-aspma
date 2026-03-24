'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Perfil {
  nome: string
  matricula: string | null
  celular: string | null
  email: string | null
  empresa: { nome: string } | null
}

function Campo({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-2.5 border-b border-gray-100 pdark:border-gray-700 last:border-0">
      <p className="text-xs text-gray-400 pdark:text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 pdark:text-gray-100 font-medium">{value || '—'}</p>
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
        <div className="w-16 h-16 bg-emerald-100 pdark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-3">
          <svg className="w-8 h-8 text-emerald-600 pdark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-800 pdark:text-gray-100 text-center leading-tight">{perfil.nome}</h1>
        {perfil.matricula && (
          <p className="text-sm text-gray-500 pdark:text-gray-400 mt-0.5">Matrícula: {perfil.matricula}</p>
        )}
        {perfil.empresa && (
          <p className="text-xs text-emerald-600 pdark:text-emerald-400 mt-1 font-medium">{perfil.empresa.nome}</p>
        )}
      </div>

      {/* Dados */}
      <div className="bg-white pdark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 pdark:border-gray-700 mb-4 overflow-hidden">
        <div className="px-4 divide-y divide-gray-100 pdark:divide-gray-700">
          <Campo label="Nome Completo" value={perfil.nome} />
          <Campo label="Matrícula" value={perfil.matricula} />
          <Campo label="Celular" value={perfil.celular} />
          <Campo label="E-mail" value={perfil.email} />
        </div>
      </div>

      {/* Aviso */}
      <div className="bg-amber-50 pdark:bg-amber-900/20 border border-amber-200 pdark:border-amber-700 rounded-2xl px-4 py-3 flex gap-3 items-start mt-2 mb-6">
        <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-xs text-amber-700 pdark:text-amber-300 leading-relaxed">
          Para atualizar seus dados, entre em contato com o setor administrativo da ASPMA.
        </p>
      </div>
    </div>
  )
}

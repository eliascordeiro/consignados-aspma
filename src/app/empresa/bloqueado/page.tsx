import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export default function EmpresaBloqueadoPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-rose-100 dark:from-gray-950 dark:to-rose-950 p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-red-200 dark:border-red-900/40">
        <div className="mx-auto h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <ShieldAlert className="h-9 w-9 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Acesso Bloqueado
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Sua consignatária está atualmente <strong>inativa</strong>. Entre em contato com o
          gerente responsável para regularizar a situação e restabelecer o acesso ao portal.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          Voltar ao Login
        </Link>
      </div>
    </div>
  )
}

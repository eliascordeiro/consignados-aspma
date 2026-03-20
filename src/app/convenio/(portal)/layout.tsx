import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getConvenioSession } from '@/lib/convenio-auth'
import ConvenioLayoutClient from './ConvenioLayoutClient'

export default async function ConvenioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getConvenioSession()

  if (!session) {
    redirect('/login')
  }

  const hdrs = await headers()
  const pathname = hdrs.get('x-pathname') || ''
  const isAlterarSenha = pathname.startsWith('/convenio/alterar-senha')

  const changedAt = session.senhaChangedAt ? new Date(session.senhaChangedAt) : null
  const daysElapsed = changedAt
    ? (Date.now() - changedAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity

  if (!isAlterarSenha && (!changedAt || daysElapsed >= 30)) {
    redirect('/convenio/alterar-senha')
  }

  const passwordDaysLeft =
    changedAt && daysElapsed < 30 && daysElapsed >= 25
      ? Math.ceil(30 - daysElapsed)
      : null

  return (
    <ConvenioLayoutClient
      fantasia={session.fantasia}
      razaoSocial={session.razaoSocial}
      tipo={session.tipo}
      passwordDaysLeft={passwordDaysLeft}
    >
      {children}
    </ConvenioLayoutClient>
  )
}

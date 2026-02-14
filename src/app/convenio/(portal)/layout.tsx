import { redirect } from 'next/navigation'
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

  return (
    <ConvenioLayoutClient
      fantasia={session.fantasia}
      razaoSocial={session.razaoSocial}
      tipo={session.tipo}
    >
      {children}
    </ConvenioLayoutClient>
  )
}

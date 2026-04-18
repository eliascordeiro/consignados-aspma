import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getConvenioSession } from '@/lib/convenio-auth'
import { prisma } from '@/lib/prisma'
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

  // Buscar dados atualizados do convênio direto do banco (não do JWT)
  const convenio = await prisma.convenio.findUnique({
    where: { id: session.convenioId },
    select: { ativo: true, tipo: true, fantasia: true, razao_soc: true, userId: true },
  })

  if (!convenio || !convenio.ativo) {
    redirect('/convenio/bloqueado')
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

  // Buscar logo do manager vinculado ao convênio
  let managerLogo: string | null = null
  if (convenio.userId) {
    const user = await prisma.users.findUnique({
      where: { id: convenio.userId },
      select: { logo: true, managerPrincipalId: true },
    })
    if (user?.logo) {
      managerLogo = user.logo
    } else if (user?.managerPrincipalId) {
      const principal = await prisma.users.findUnique({
        where: { id: user.managerPrincipalId },
        select: { logo: true },
      })
      managerLogo = principal?.logo || null
    }
  }

  return (
    <ConvenioLayoutClient
      fantasia={convenio.fantasia || session.fantasia}
      razaoSocial={convenio.razao_soc || session.razaoSocial}
      tipo={convenio.tipo || null}
      passwordDaysLeft={passwordDaysLeft}
      managerLogo={managerLogo}
    >
      {children}
    </ConvenioLayoutClient>
  )
}

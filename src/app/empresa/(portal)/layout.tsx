import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getEmpresaSession } from '@/lib/empresa-auth'
import { prisma } from '@/lib/prisma'
import EmpresaLayoutClient from './EmpresaLayoutClient'

export default async function EmpresaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getEmpresaSession()
  if (!session) redirect('/login')

  const empresa = await prisma.empresa.findUnique({
    where: { id: session.empresaId },
    select: {
      ativo: true,
      tipo: true,
      nome: true,
      cnpj: true,
      email: true,
      cidade: true,
      uf: true,
      userId: true,
    },
  })

  if (!empresa || !empresa.ativo) redirect('/empresa/bloqueado')

  const hdrs = await headers()
  const pathname = hdrs.get('x-pathname') || ''
  const isAlterarSenha = pathname.startsWith('/empresa/alterar-senha')

  const changedAt = session.senhaChangedAt ? new Date(session.senhaChangedAt) : null
  const daysElapsed = changedAt
    ? (Date.now() - changedAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity

  if (!isAlterarSenha && (!changedAt || daysElapsed >= 30)) {
    redirect('/empresa/alterar-senha')
  }

  const passwordDaysLeft =
    changedAt && daysElapsed < 30 && daysElapsed >= 25
      ? Math.ceil(30 - daysElapsed)
      : null

  // Logo do manager vinculado
  let managerLogo: string | null = null
  if (empresa.userId) {
    const user = await prisma.users.findUnique({
      where: { id: empresa.userId },
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
    <EmpresaLayoutClient
      nome={empresa.nome}
      cnpj={empresa.cnpj}
      email={empresa.email}
      cidade={empresa.cidade}
      uf={empresa.uf}
      tipo={empresa.tipo || null}
      passwordDaysLeft={passwordDaysLeft}
      managerLogo={managerLogo}
    >
      {children}
    </EmpresaLayoutClient>
  )
}

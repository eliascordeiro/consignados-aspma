import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import PortalLayoutClient from './PortalLayoutClient'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

// Rotas públicas que não precisam de autenticação
const PUBLIC_ROUTES = ['/portal/login', '/portal/primeiro-acesso', '/portal/redefinir-senha']

async function getManagerInfo(socioId: string): Promise<{ managerName: string | null; managerLogo: string | null }> {
  try {
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: { userId: true, empresaId: true },
    })

    if (!socio) return { managerName: null, managerLogo: null }

    // Via Socio.userId → users
    if (socio.userId) {
      const user = await prisma.users.findUnique({
        where: { id: socio.userId },
        select: { name: true, logo: true, managerPrincipalId: true },
      })
      if (user) {
        if (user.managerPrincipalId) {
          const principal = await prisma.users.findUnique({
            where: { id: user.managerPrincipalId },
            select: { name: true, logo: true },
          })
          return {
            managerName: principal?.name || user.name,
            managerLogo: principal?.logo || user.logo || null,
          }
        }
        return { managerName: user.name, managerLogo: user.logo || null }
      }
    }

    // Fallback: Socio.empresaId → Empresa.userId → users
    if (socio.empresaId) {
      const empresa = await prisma.empresa.findUnique({
        where: { id: socio.empresaId },
        select: { userId: true },
      })
      if (empresa?.userId) {
        const user = await prisma.users.findUnique({
          where: { id: empresa.userId },
          select: { name: true, logo: true, managerPrincipalId: true },
        })
        if (user) {
          if (user.managerPrincipalId) {
            const principal = await prisma.users.findUnique({
              where: { id: user.managerPrincipalId },
              select: { name: true, logo: true },
            })
            return {
              managerName: principal?.name || user.name,
              managerLogo: principal?.logo || user.logo || null,
            }
          }
          return { managerName: user.name, managerLogo: user.logo || null }
        }
      }
    }

    return { managerName: null, managerLogo: null }
  } catch (error) {
    console.error('[portal/layout] Erro ao buscar manager info:', error)
    return { managerName: null, managerLogo: null }
  }
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const pathname = hdrs.get('x-pathname') || ''

  // Rotas públicas — não precisam de verificação
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return <PortalLayoutClient>{children}</PortalLayoutClient>
  }

  // Verificar autenticação via cookie JWT
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_token')?.value

  if (!token) {
    redirect('/portal/login')
  }

  let socioId: string | null = null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    socioId = payload.socioId as string
  } catch {
    redirect('/portal/login')
  }

  // Buscar logo do manager no servidor
  const { managerName, managerLogo } = await getManagerInfo(socioId)

  return (
    <PortalLayoutClient managerLogo={managerLogo} managerName={managerName}>
      {children}
    </PortalLayoutClient>
  )
}

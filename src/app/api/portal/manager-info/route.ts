import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

async function getSocioId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('portal_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.socioId as string
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const socioId = await getSocioId(request)
  if (!socioId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        userId: true,
        empresaId: true,
      },
    })

    if (!socio) {
      return NextResponse.json({ managerName: null, managerLogo: null })
    }

    // Tenta primeiro via Socio.userId → users
    if (socio.userId) {
      const user = await prisma.users.findUnique({
        where: { id: socio.userId },
        select: { name: true, logo: true, managerPrincipalId: true },
      })

      if (user) {
        // Se é sub-manager, buscar logo do principal
        if (user.managerPrincipalId) {
          const principal = await prisma.users.findUnique({
            where: { id: user.managerPrincipalId },
            select: { name: true, logo: true },
          })
          return NextResponse.json({
            managerName: principal?.name || user.name,
            managerLogo: principal?.logo || user.logo || null,
          })
        }

        return NextResponse.json({
          managerName: user.name,
          managerLogo: user.logo || null,
        })
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
            return NextResponse.json({
              managerName: principal?.name || user.name,
              managerLogo: principal?.logo || user.logo || null,
            })
          }

          return NextResponse.json({
            managerName: user.name,
            managerLogo: user.logo || null,
          })
        }
      }
    }

    return NextResponse.json({ managerName: null, managerLogo: null })
  } catch (error) {
    console.error('Erro ao buscar info do manager no portal:', error)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}

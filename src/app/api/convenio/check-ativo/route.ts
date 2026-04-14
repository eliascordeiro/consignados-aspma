import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const login = request.nextUrl.searchParams.get('login')
  if (!login) {
    return NextResponse.json({ inativo: false })
  }

  const convenio = await prisma.convenio.findFirst({
    where: {
      OR: [
        { usuario: { equals: login, mode: 'insensitive' } },
        { email: { equals: login, mode: 'insensitive' } },
      ],
    },
    select: { ativo: true },
  })

  return NextResponse.json({ inativo: convenio ? !convenio.ativo : false })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const login = request.nextUrl.searchParams.get('login')
  if (!login) return NextResponse.json({ inativa: false })

  const empresa = await prisma.empresa.findFirst({
    where: { email: { equals: login, mode: 'insensitive' } },
    select: { ativo: true },
  })
  return NextResponse.json({ inativa: empresa ? !empresa.ativo : false })
}

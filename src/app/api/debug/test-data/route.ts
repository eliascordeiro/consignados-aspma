import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint temporário de debug - REMOVER EM PRODUÇÃO
export async function GET(request: NextRequest) {
  try {
    // Buscar convênio de teste
    const convenio = await prisma.convenio.findFirst({
      where: { usuario: 'teste' },
      select: {
        id: true,
        usuario: true,
        senha: true,
        ativo: true,
        razao_soc: true,
      },
    })

    // Contar sócios de teste
    const sociosCount = await prisma.socio.count({
      where: { matricula: { startsWith: '999' } },
    })

    return NextResponse.json({
      convenioExiste: convenio ? 'SIM' : 'NÃO',
      convenio: convenio ? {
        id: convenio.id,
        usuario: convenio.usuario,
        senhaLength: convenio.senha?.length || 0,
        senhaPreview: convenio.senha?.substring(0, 4) + '***',
        ativo: convenio.ativo,
        razao_soc: convenio.razao_soc,
      } : null,
      sociosTestCount: sociosCount,
      databaseUrl: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'hidden',
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

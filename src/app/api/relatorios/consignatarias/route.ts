import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Busca empresas que têm sócios vinculados via empresaId (novo sistema)
    const empresas = await db.empresa.findMany({
      where: {
        socios: {
          some: {},
        },
      },
      select: {
        id: true,
        nome: true,
        tipo: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });

    return NextResponse.json(empresas);
  } catch (error: any) {
    console.error('[GET /api/relatorios/consignatarias]', error);
    return NextResponse.json({ error: 'Erro ao buscar consignatárias' }, { status: 500 });
  }
}

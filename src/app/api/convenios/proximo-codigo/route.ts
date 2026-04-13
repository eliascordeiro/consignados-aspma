import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    // Busca todos os códigos existentes na tabela convenio
    const convenios = await db.convenio.findMany({
      select: { codigo: true },
      where: { codigo: { not: null } },
    });

    // Extrai os códigos numéricos e ordena
    const codigos = convenios
      .map((c) => parseInt(c.codigo || '', 10))
      .filter((n) => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);

    // Encontra o primeiro número disponível (gap na sequência)
    let proximo = 1;
    for (const cod of codigos) {
      if (cod === proximo) {
        proximo++;
      } else if (cod > proximo) {
        break; // encontrou gap
      }
      // duplicatas (cod < proximo) são ignoradas
    }

    return NextResponse.json({ codigo: String(proximo) });
  } catch (error) {
    console.error('Erro ao buscar próximo código:', error);
    return NextResponse.json({ error: 'Erro ao buscar próximo código' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint temporário para criar dados de teste - REMOVER EM PRODUÇÃO
export async function POST(request: NextRequest) {
  try {
    // Proteção básica: requer senha secreta
    const { secret } = await request.json()
    if (secret !== process.env.SEED_SECRET && secret !== 'seed-test-data-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Criar convênio de teste
    const convenio = await prisma.convenio.upsert({
      where: { usuario: 'teste' },
      update: {
        senha: 'teste123',
        ativo: true,
        razao_soc: 'CONVÊNIO DE TESTE',
      },
      create: {
        usuario: 'teste',
        senha: 'teste123',
        ativo: true,
        razao_soc: 'CONVÊNIO DE TESTE',
        cnpj: '00000000000001',
        endereco: 'Rua Teste, 123',
        cidade: 'Teste City',
        uf: 'TS',
        cep: '00000-000',
        telefone: '(00) 0000-0000',
        email: 'teste@teste.com',
      },
    })

    // 2. Criar sócios de teste
    const socios = []
    for (let i = 1; i <= 3; i++) {
      const matricula = `99900${i}`
      const cpf = `00000000${i}00`
      
      const socio = await prisma.socio.upsert({
        where: { matricula },
        update: {
          nome: `SOCIO TESTE ${i}`,
          cpf,
          convenio_id: convenio.id,
        },
        create: {
          matricula,
          nome: `SOCIO TESTE ${i}`,
          cpf,
          convenio_id: convenio.id,
          nascimento: new Date('1980-01-01'),
          situacao: 'A',
          cargo: 'TESTE',
          admissao: new Date('2020-01-01'),
        },
      })
      
      socios.push(socio)
    }

    return NextResponse.json({
      success: true,
      convenio: {
        id: convenio.id,
        usuario: convenio.usuario,
        razao_soc: convenio.razao_soc,
      },
      socios: socios.map(s => ({
        id: s.id,
        matricula: s.matricula,
        nome: s.nome,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

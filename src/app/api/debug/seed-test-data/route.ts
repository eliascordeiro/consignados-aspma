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
    let convenio = await prisma.convenio.findFirst({
      where: { usuario: 'teste' },
    })

    if (convenio) {
      // Atualizar convênio existente
      convenio = await prisma.convenio.update({
        where: { id: convenio.id },
        data: {
          senha: 'teste123',
          ativo: true,
          razao_soc: 'CONVÊNIO DE TESTE',
        },
      })
    } else {
      // Criar novo convênio
      convenio = await prisma.convenio.create({
        data: {
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
    }

    // 2. Criar sócios de teste
    const socios = []
    for (let i = 1; i <= 3; i++) {
      const matricula = `99900${i}`
      const cpf = `00000000${i}00`
      
      let socio = await prisma.socio.findFirst({
        where: { matricula },
      })

      if (socio) {
        // Atualizar sócio existente
        socio = await prisma.socio.update({
          where: { id: socio.id },
          data: {
            nome: `SOCIO TESTE ${i}`,
            cpf,
            convenio_id: convenio.id,
          },
        })
      } else {
        // Criar novo sócio
        socio = await prisma.socio.create({
          data: {
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
      }
      
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

import { PrismaClient } from '@prisma/client';

const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/consignados_temp';
process.env.DATABASE_URL = LOCAL_DATABASE_URL;

const prisma = new PrismaClient();

async function main() {
  // Busca o maior ID migrado através de uma parcela do PostgreSQL
  const ultimaParcela = await prisma.parcela.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, vendaId: true, numeroParcela: true }
  });

  if (!ultimaParcela) {
    console.log('Nenhuma parcela encontrada no banco local.');
    return;
  }

  // Busca a venda correspondente
  const venda = await prisma.venda.findUnique({
    where: { id: ultimaParcela.vendaId },
    include: { socio: true }
  });

  console.log('📊 Última parcela migrada:');
  console.log(`   Venda ID: ${venda?.numeroVenda}`);
  console.log(`   Matrícula: ${venda?.socio.matricula}`);
  console.log(`   Parcela #: ${ultimaParcela.numeroParcela}`);
  console.log('');
  
  // Conta total de parcelas
  const totalParcelas = await prisma.parcela.count();
  console.log(`✅ Total parcelas migradas: ${totalParcelas.toLocaleString('pt-BR')}`);

  await prisma.$disconnect();
}

main();

import { PrismaClient } from '@prisma/client';

const railway = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }}
});

(async () => {
  try {
    console.log('Removendo users e logs com referencia a fialla/fialla2...\n');

    // Buscar todos os users com fialla no nome ou email
    const users = await railway.users.findMany({
      where: {
        OR: [
          { email: { contains: 'fialla', mode: 'insensitive' } },
          { name: { contains: 'fialla', mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, email: true, role: true }
    });

    console.log('Users encontrados:', users.length);

    if (users.length === 0) {
      console.log('Nenhum user encontrado com fialla');
      return;
    }

    let totalLogs = 0;
    let totalUsers = 0;

    for (const user of users) {
      console.log('\nProcessando:', user.name, '-', user.email, '-', user.role);
      
      // Deletar logs
      const logs = await railway.auditLog.deleteMany({
        where: { userId: user.id }
      });
      console.log('  Logs deletados:', logs.count);
      totalLogs += logs.count;

      // Desvincular convenios
      const convs = await railway.convenio.updateMany({
        where: { userId: user.id },
        data: { userId: null }
      });
      if (convs.count > 0) {
        console.log('  Convenios desvinculados:', convs.count);
      }

      // Deletar user
      await railway.users.delete({
        where: { id: user.id }
      });
      console.log('  User deletado');
      totalUsers++;
    }

    console.log('\n=== RESUMO ===');
    console.log('Users deletados:', totalUsers);
    console.log('Logs deletados:', totalLogs);
    console.log('\nLimpeza concluida!');

  } finally {
    await railway.$disconnect();
  }
})();

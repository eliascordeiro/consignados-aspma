import { PrismaClient } from '@prisma/client';

const railway = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway' }}
});

(async () => {
  try {
    console.log('=== Verificando user MANAGER ===\n');

    const user = await railway.users.findFirst({
      where: { email: 'elias157508@gmail.com' },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!user) {
      console.log('User nao encontrado');
      return;
    }

    console.log('USER:', user.name);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('ID:', user.id);

    const convenios = await railway.convenio.findMany({
      where: { userId: user.id },
      select: { id: true, usuario: true, razao_soc: true }
    });

    console.log('\nConvenios vinculados a este user:', convenios.length);
    
    if (convenios.length > 0) {
      console.log('\nPROBLEMA! User MANAGER nao deveria ter convenio vinculado!\n');
      convenios.forEach(c => {
        console.log('  Conv', c.id, '-', c.usuario, '-', c.razao_soc?.substring(0, 40));
      });
      
      console.log('\nRemovendo vinculos...');
      const updated = await railway.convenio.updateMany({
        where: { userId: user.id },
        data: { userId: null }
      });
      console.log('OK -', updated.count, 'convenios desvinculados');
    } else {
      console.log('OK - Nenhum convenio vinculado (banco correto)');
    }

    // Verificar TODOS os convênios com userId setado
    console.log('\n=== Verificando TODOS convenios com userId ===\n');
    const allWithUserId = await railway.convenio.findMany({
      where: { userId: { not: null } },
      select: { id: true, usuario: true, userId: true },
      take: 20
    });
    console.log('Total de convenios com userId setado:', allWithUserId.length);
    if (allWithUserId.length > 0) {
      allWithUserId.forEach(c => {
        const isThisUser = c.userId === user.id ? ' <-- ESTE USER!' : '';
        console.log('  Conv', c.id, '-', c.usuario, '-', c.userId?.substring(0, 12), isThisUser);
      });
    }

    console.log('\n=== INSTRUCOES ===');
    console.log('1. Abra o navegador em ABA ANONIMA (Ctrl+Shift+N)');
    console.log('2. Acesse: https://consignados-aspma-production.up.railway.app/login');
    console.log('3. Login com: elias157508@gmail.com');
    console.log('4. Deve redirecionar para: /cliente/dashboard (NAO /convenio/dashboard)');
    console.log('\nSe ainda redirecionar errado, o problema e CACHE do navegador!');

  } finally {
    await railway.$disconnect();
  }
})();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addVendasPermissions() {
  console.log('🔄 Adicionando permissões de vendas aos usuários...\n');

  try {
    // Busca todos os usuários ADMIN e MANAGER
    const usuarios = await prisma.users.findMany({
      where: {
        role: {
          in: ['ADMIN', 'MANAGER'],
        },
      },
    });

    console.log(`📋 Encontrados ${usuarios.length} usuário(s) (ADMIN/MANAGER)\n`);

    const novasPermissoes = [
      'vendas.view',
      'vendas.create',
      'vendas.edit',
      'vendas.delete',
      'vendas.export',
    ];

    for (const usuario of usuarios) {
      const permissoesAtuais = usuario.permissions || [];
      const permissoesSet = new Set(permissoesAtuais);

      let adicionadas = 0;
      for (const perm of novasPermissoes) {
        if (!permissoesSet.has(perm)) {
          permissoesSet.add(perm);
          adicionadas++;
        }
      }

      if (adicionadas > 0) {
        await prisma.users.update({
          where: { id: usuario.id },
          data: {
            permissions: Array.from(permissoesSet),
          },
        });

        console.log(`✅ ${usuario.name} (${usuario.email})`);
        console.log(`   Role: ${usuario.role}`);
        console.log(`   Adicionadas: ${adicionadas} permissões`);
        console.log(`   Total: ${permissoesSet.size} permissões\n`);
      } else {
        console.log(`⏭️  ${usuario.name} já possui todas as permissões de vendas\n`);
      }
    }

    console.log('✨ Concluído!');
  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addVendasPermissions();

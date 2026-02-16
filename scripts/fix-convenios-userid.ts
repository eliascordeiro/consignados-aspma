#!/usr/bin/env tsx
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  🔧 FIX: Vincular convênios migrados ao MANAGER (userId)        ║
 * ║                                                                  ║
 * ║  Problema: migrate-all-to-railway.ts criava convênios sem        ║
 * ║  userId, então o MANAGER não via nenhum conveniado na tela.      ║
 * ║                                                                  ║
 * ║  Solução: Setar userId do MANAGER em todos os convênios que      ║
 * ║  ainda não têm userId (NULL).                                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Uso: npx tsx app/scripts/fix-convenios-userid.ts
 */

import { PrismaClient } from '@prisma/client';

const RAILWAY_URL = 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway';

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: RAILWAY_URL } }
  });

  try {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  🔧 FIX: Vincular convênios ao MANAGER (userId)              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // 1. Buscar o MANAGER (elias157508@gmail.com)
    const manager = await prisma.users.findFirst({
      where: { 
        role: 'MANAGER',
        email: 'elias157508@gmail.com'
      },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!manager) {
      // Fallback: buscar primeiro MANAGER disponível
      const fallbackManager = await prisma.users.findFirst({
        where: { role: 'MANAGER' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, role: true }
      });

      if (!fallbackManager) {
        console.error('❌ Nenhum usuário MANAGER encontrado!');
        process.exit(1);
      }

      console.log(`⚠️  MANAGER elias157508@gmail.com não encontrado.`);
      console.log(`   Usando fallback: ${fallbackManager.name} (${fallbackManager.email})\n`);
    }

    const targetManager = manager || await prisma.users.findFirst({
      where: { role: 'MANAGER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!targetManager) {
      console.error('❌ Nenhum MANAGER encontrado!');
      process.exit(1);
    }

    console.log(`👤 MANAGER: ${targetManager.name} (${targetManager.email})`);
    console.log(`   ID: ${targetManager.id}\n`);

    // 2. Contar convênios sem userId
    const semUserId = await prisma.convenio.count({
      where: { userId: null }
    });

    const comUserId = await prisma.convenio.count({
      where: { userId: { not: null } }
    });

    const total = await prisma.convenio.count();

    console.log(`📊 Estado atual dos convênios:`);
    console.log(`   Total:       ${total}`);
    console.log(`   Sem userId:  ${semUserId}`);
    console.log(`   Com userId:  ${comUserId}\n`);

    if (semUserId === 0) {
      console.log('✅ Todos os convênios já têm userId! Nada a fazer.');
      return;
    }

    // 3. Atualizar convênios sem userId → setar userId do MANAGER
    console.log(`🔄 Vinculando ${semUserId} convênios ao MANAGER...`);

    const result = await prisma.convenio.updateMany({
      where: { userId: null },
      data: { userId: targetManager.id }
    });

    console.log(`   ✅ ${result.count} convênios atualizados!\n`);

    // 4. Verificação final
    const finalSemUserId = await prisma.convenio.count({
      where: { userId: null }
    });

    const finalComManagerId = await prisma.convenio.count({
      where: { userId: targetManager.id }
    });

    console.log(`📊 Estado final dos convênios:`);
    console.log(`   Total:         ${total}`);
    console.log(`   Sem userId:    ${finalSemUserId}`);
    console.log(`   Com MANAGER:   ${finalComManagerId}`);
    console.log(`   Com outros:    ${total - finalSemUserId - finalComManagerId}\n`);

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║               ✅ CORREÇÃO CONCLUÍDA!                         ║');
    console.log('║                                                              ║');
    console.log('║  O MANAGER agora verá todos os conveniados na tela.          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

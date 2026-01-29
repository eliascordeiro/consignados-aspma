/**
 * Migrar sócios do MySQL para PostgreSQL Local
 * Adaptado para usar banco local de desenvolvimento
 */

import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.remote') });

const prisma = new PrismaClient();

async function migrateSociosToLocal() {
  let mysqlConnection;

  try {
    console.log('🔄 Migrando sócios do MySQL para PostgreSQL Local\n');

    // 1. Conectar ao MySQL
    console.log('📡 Conectando ao MySQL remoto...');
    mysqlConnection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });
    console.log('✅ MySQL conectado!\n');

    // 2. Buscar todos os sócios do MySQL
    console.log('📥 Buscando sócios do MySQL...');
    const [socios] = await mysqlConnection.query('SELECT * FROM socios');
    
    if (!Array.isArray(socios)) {
      throw new Error('Nenhum sócio encontrado no MySQL');
    }

    console.log(`✅ ${socios.length} sócios encontrados\n`);

    // 3. Limpar sócios existentes no PostgreSQL
    console.log('🗑️  Limpando sócios existentes no PostgreSQL...');
    const deleted = await prisma.socio.deleteMany({});
    console.log(`✅ ${deleted.count} sócios removidos\n`);

    // 4. Migrar sócios
    console.log('💾 Migrando sócios...');
    let migrados = 0;
    let erros = 0;

    for (const socio of socios as any[]) {
      try {
        await prisma.socio.create({
          data: {
            id: socio.id ? socio.id.toString() : `socio_${socio.matricula}`,
            nome: socio.associado || 'SEM NOME',
            cpf: socio.cpf || null,
            rg: socio.rg || null,
            matricula: socio.matricula || null,
            empresaId: null, // Será configurado depois
            funcao: socio.funcao || null,
            lotacao: socio.lotacao || null,
            endereco: socio.endereco || null,
            bairro: socio.bairro || null,
            cep: socio.cep || null,
            cidade: socio.cidade || null,
            telefone: socio.fone || null,
            celular: socio.celular || null,
            email: socio.email || null,
            contato: socio.contato || null,
            dataCadastro: socio.data || null,
            dataAdmissao: null,
            dataNascimento: socio.nascimento || null,
            limite: socio.limite || null,
            margemConsig: null,
            gratificacao: socio.gratif || null,
            autorizado: socio.autorizado || null,
            sexo: socio.sexo || null,
            estadoCivil: socio.est_civil || null,
            numCompras: socio.ncompras ? parseInt(socio.ncompras) : null,
            tipo: socio.tipo || null,
            agencia: socio.agencia || null,
            conta: socio.conta || null,
            banco: socio.banco || null,
            devolucao: socio.devolucao || null,
            bloqueio: socio.bloqueio || null,
            motivoBloqueio: socio.motivo || null,
            codTipo: socio.codtipo || null,
            senha: socio.senha?.toString() || null,
            dataExclusao: socio.data_exclusao || null,
            motivoExclusao: socio.motivo_exclusao || null,
            ativo: socio.bloqueio !== 'S',
            userId: null,
          }
        });

        migrados++;
        
        if (migrados % 100 === 0) {
          console.log(`   ✓ ${migrados}/${socios.length} sócios migrados...`);
        }
      } catch (error) {
        erros++;
        console.error(`   ❌ Erro ao migrar sócio ${socio.matricula}:`, error);
      }
    }

    console.log(`\n✅ Migração concluída!`);
    console.log(`   Migrados com sucesso: ${migrados}`);
    console.log(`   Erros: ${erros}`);
    console.log(`   Total: ${socios.length}\n`);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
      console.log('🔌 Conexão MySQL fechada');
    }
    await prisma.$disconnect();
    console.log('🔌 Conexão PostgreSQL fechada');
  }
}

migrateSociosToLocal();

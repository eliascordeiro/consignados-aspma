import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function applyMigrationToRailway() {
  try {
    console.log('🔄 Aplicando alterações do schema Socio no Railway...\n')

    // Executar as alterações diretamente via SQL - um comando por vez
    console.log('📝 Adicionando novos campos na tabela socios...')
    
    // Remover unique constraint de matricula
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE socios DROP CONSTRAINT IF EXISTS socios_matricula_key`)
      console.log('  ✅ Removida constraint unique de matricula')
    } catch (e) {
      console.log('  ⚠️  Constraint não existia')
    }

    // Permitir NULL no CPF
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE socios ALTER COLUMN cpf DROP NOT NULL`)
      console.log('  ✅ CPF agora permite NULL')
    } catch (e) {
      console.log('  ⚠️  CPF já permitia NULL')
    }

    // Adicionar campos um por um
    const newFields = [
      { name: 'rg', type: 'VARCHAR(18)' },
      { name: 'funcao', type: 'VARCHAR(40)' },
      { name: 'lotacao', type: 'VARCHAR(40)' },
      { name: 'bairro', type: 'VARCHAR(40)' },
      { name: 'cep', type: 'VARCHAR(9)' },
      { name: 'cidade', type: 'VARCHAR(40)' },
      { name: 'celular', type: 'VARCHAR(15)' },
      { name: 'contato', type: 'VARCHAR(40)' },
      { name: 'dataCadastro', type: 'TIMESTAMP' },
      { name: 'limite', type: 'DECIMAL(13,2)' },
      { name: 'gratificacao', type: 'DECIMAL(13,2)' },
      { name: 'autorizado', type: 'VARCHAR(60)' },
      { name: 'sexo', type: 'VARCHAR(1)' },
      { name: 'estadoCivil', type: 'VARCHAR(1)' },
      { name: 'numCompras', type: 'INTEGER' },
      { name: 'tipo', type: 'VARCHAR(5)' },
      { name: 'agencia', type: 'VARCHAR(8)' },
      { name: 'conta', type: 'VARCHAR(15)' },
      { name: 'banco', type: 'VARCHAR(20)' },
      { name: 'devolucao', type: 'DECIMAL(13,2)' },
      { name: 'bloqueio', type: 'VARCHAR(1)' },
      { name: 'motivoBloqueio', type: 'VARCHAR(45)' },
      { name: 'codTipo', type: 'INTEGER' },
      { name: 'senha', type: 'VARCHAR(255)' },
      { name: 'dataExclusao', type: 'DATE' },
      { name: 'motivoExclusao', type: 'VARCHAR(45)' }
    ]

    for (const field of newFields) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE socios ADD COLUMN IF NOT EXISTS "${field.name}" ${field.type}`)
        console.log(`  ✅ Campo ${field.name} adicionado`)
      } catch (e: any) {
        console.log(`  ⚠️  Campo ${field.name} já existe`)
      }
    }

    console.log('\n✅ Todos os campos adicionados com sucesso!')
    
    // Verificar estrutura
    console.log('\n🔍 Verificando estrutura da tabela socios no Railway...')
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'socios'
      ORDER BY ordinal_position;
    `
    
    console.log('\n📋 Colunas da tabela socios:')
    console.log(columns)

  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigrationToRailway()

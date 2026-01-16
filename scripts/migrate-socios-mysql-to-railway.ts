import { PrismaClient } from '@prisma/client'
import mysql from 'mysql2/promise'

// Conecta ao Railway PostgreSQL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

async function migrateSocios() {
  let mysqlConnection

  try {
    console.log('🔄 Migrando sócios do MySQL para Railway PostgreSQL\n')

    // 1. Buscar usuário A.S.P.M.A
    console.log('👤 Buscando usuário A.S.P.M.A...')
    const aspmaUser = await prisma.user.findUnique({
      where: { email: 'elias157508@gmail.com' }
    })

    if (!aspmaUser) {
      throw new Error('Usuário A.S.P.M.A não encontrado!')
    }
    console.log(`✅ Usuário encontrado: ${aspmaUser.name} (${aspmaUser.id})\n`)

    // 2. Buscar empresas (consignatarias)
    console.log('🏢 Buscando empresas no Railway...')
    const empresas = await prisma.empresa.findMany({
      where: { userId: aspmaUser.id }
    })
    console.log(`✅ ${empresas.length} empresas encontradas\n`)

    // Criar mapa de consignataria_id -> empresa_id
    const consignatariaMap: Record<number, number> = {}
    empresas.forEach(empresa => {
      // Fundo de Previdência = consignataria 1
      // Prefeitura = consignataria 2
      // NENHUMA = consignataria 0
      if (empresa.nome.includes('FUNDO DE PREVIDENCIA')) {
        consignatariaMap[1] = empresa.id
      } else if (empresa.nome.includes('PREFEITURA')) {
        consignatariaMap[2] = empresa.id
      } else if (empresa.nome === 'NENHUMA') {
        consignatariaMap[0] = empresa.id
      }
    })

    console.log('📋 Mapeamento de consignatárias:')
    console.log(`   MySQL consignataria 0 -> Railway empresa ${consignatariaMap[0]} (NENHUMA)`)
    console.log(`   MySQL consignataria 1 -> Railway empresa ${consignatariaMap[1]} (FUNDO)`)
    console.log(`   MySQL consignataria 2 -> Railway empresa ${consignatariaMap[2]} (PREFEITURA)\n`)

    // 3. Conectar ao MySQL
    console.log('📡 Conectando ao MySQL remoto...')
    mysqlConnection = await mysql.createConnection({
      host: '200.98.112.240',
      port: 3306,
      user: 'eliascordeiro',
      password: 'D24m0733@!',
      database: 'aspma'
    })
    console.log('✅ MySQL conectado!\n')

    // 4. Buscar todos os sócios do MySQL
    console.log('📥 Buscando sócios do MySQL...')
    const [socios] = await mysqlConnection.query('SELECT * FROM socios')
    
    if (!Array.isArray(socios)) {
      throw new Error('Nenhum sócio encontrado no MySQL')
    }

    console.log(`✅ ${socios.length} sócios encontrados\n`)

    // 5. Limpar sócios existentes no Railway
    console.log('🗑️  Limpando sócios existentes no Railway...')
    const deleted = await prisma.socio.deleteMany({
      where: { userId: aspmaUser.id }
    })
    console.log(`✅ ${deleted.count} sócios removidos\n`)

    // 6. Migrar sócios
    console.log('💾 Migrando sócios para Railway...\n')
    let migrated = 0
    let skipped = 0

    for (const socio of socios as any[]) {
      try {
        // Mapear consignataria do MySQL para empresa do Railway
        const empresaId = consignatariaMap[socio.consignataria]
        
        if (empresaId === undefined) {
          console.log(`⚠️  Pulando sócio ${socio.associado} - consignataria ${socio.consignataria} não mapeada`)
          skipped++
          continue
        }

        await prisma.socio.create({
          data: {
            userId: aspmaUser.id,
            empresaId: empresaId,
            nome: socio.associado || 'SEM NOME',
            cpf: socio.cpf?.replace(/[^\d]/g, '') || null,
            rg: socio.rg,
            matricula: socio.matricula,
            funcao: socio.funcao,
            lotacao: socio.lotacao,
            endereco: socio.endereco,
            bairro: socio.bairro,
            cep: socio.cep,
            cidade: socio.cidade,
            telefone: socio.fone,
            celular: socio.celular,
            email: socio.email,
            contato: socio.contato,
            dataCadastro: socio.data,
            dataNascimento: socio.nascimento,
            limite: socio.limite,
            margemConsig: socio.mensal,
            gratificacao: socio.gratif,
            autorizado: socio.autorizado,
            sexo: socio.sexo,
            estadoCivil: socio.est_civil,
            numCompras: socio.ncompras ? Math.floor(socio.ncompras) : null,
            tipo: socio.tipo,
            agencia: socio.agencia,
            conta: socio.conta,
            banco: socio.banco,
            devolucao: socio.devolucao,
            bloqueio: socio.bloqueio,
            motivoBloqueio: socio.motivo,
            codTipo: socio.codtipo,
            senha: socio.senha?.toString(),
            dataExclusao: socio.data_exclusao,
            motivoExclusao: socio.motivo_exclusao,
            ativo: !socio.bloqueio || socio.bloqueio === ''
          }
        })

        migrated++
        if (migrated % 100 === 0) {
          console.log(`   ✅ ${migrated} sócios migrados...`)
        }
      } catch (error: any) {
        console.error(`❌ Erro ao migrar sócio ${socio.associado}:`, error.message)
        skipped++
      }
    }

    console.log('\n════════════════════════════════════════════════════════════')
    console.log('📊 RESUMO DA MIGRAÇÃO')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`Total no MySQL:        ${socios.length}`)
    console.log(`Migrados com sucesso:  ${migrated}`)
    console.log(`Pulados/Erros:         ${skipped}`)
    console.log('════════════════════════════════════════════════════════════\n')

    // 7. Verificar resultado
    const finalCount = await prisma.socio.count({
      where: { userId: aspmaUser.id }
    })
    console.log(`✅ Total de sócios no Railway: ${finalCount}\n`)

    // Mostrar alguns exemplos
    console.log('📋 Primeiros 5 sócios migrados:\n')
    const samples = await prisma.socio.findMany({
      where: { userId: aspmaUser.id },
      take: 5,
      include: { empresa: true }
    })

    samples.forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.nome}`)
      console.log(`   CPF: ${s.cpf || 'N/A'}`)
      console.log(`   Matrícula: ${s.matricula || 'N/A'}`)
      console.log(`   Empresa: ${s.empresa.nome}`)
      console.log(`   Função: ${s.funcao || 'N/A'}`)
      console.log(`   Ativo: ${s.ativo}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Erro na migração:', error)
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end()
      console.log('🔌 Conexão MySQL encerrada')
    }
    await prisma.$disconnect()
    console.log('🔌 Conexão Railway encerrada')
  }
}

migrateSocios()

import { PrismaClient } from '@prisma/client'
import mysql from 'mysql2/promise'

// Prisma conectado no Railway
const railwayPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway'
    }
  }
})

// Configuração MySQL remoto
const mysqlConfig = {
  host: '200.98.112.240',
  port: 3306,
  user: 'eliascordeiro',
  password: 'D24m0733@!',
  database: 'aspma'
}

async function migrateConsignatariasConvenios() {
  let mysqlConnection: mysql.Connection | null = null

  try {
    console.log('🚀 Iniciando migração MySQL → Railway\n')
    
    // ═══════════════════════════════════════════════════════════════
    // PASSO 1: Conectar no Railway
    // ═══════════════════════════════════════════════════════════════
    console.log('📡 [1/6] Conectando no Railway...')
    await railwayPrisma.$connect()
    console.log('   ✅ Conectado no Railway!\n')

    // ═══════════════════════════════════════════════════════════════
    // PASSO 2: Limpar tabelas (respeitando foreign keys)
    // ═══════════════════════════════════════════════════════════════
    console.log('🗑️  [2/7] Limpando tabelas no Railway...')
    
    // Primeiro: limpar sócios (dependem de empresas)
    console.log('   🗑️  Limpando "socios"...')
    const sociosDeleted = await railwayPrisma.socio.deleteMany({})
    console.log(`   ✅ ${sociosDeleted.count} sócios removidos`)
    
    // Segundo: limpar empresas
    console.log('   🗑️  Limpando "empresas"...')
    const empresasDeleted = await railwayPrisma.empresa.deleteMany({})
    console.log(`   ✅ ${empresasDeleted.count} empresas removidas`)
    
    // Terceiro: limpar convênios
    console.log('   🗑️  Limpando "convenio"...')
    const conveniosDeleted = await railwayPrisma.convenio.deleteMany({})
    console.log(`   ✅ ${conveniosDeleted.count} convênios removidos\n`)

    // ═══════════════════════════════════════════════════════════════
    // PASSO 3: (pulado - mesclado no passo 2)
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // PASSO 4: Conectar no MySQL remoto
    // ═══════════════════════════════════════════════════════════════
    console.log('📡 [4/7] Conectando no MySQL remoto...')
    mysqlConnection = await mysql.createConnection(mysqlConfig)
    console.log('   ✅ Conectado no MySQL!\n')

    // Buscar userId padrão (primeiro ADMIN ou MANAGER do Railway)
    const defaultUser = await railwayPrisma.users.findFirst({
      where: {
        OR: [
          { role: 'ADMIN' },
          { role: 'MANAGER' }
        ]
      },
      orderBy: { createdAt: 'asc' }
    })

    if (!defaultUser) {
      throw new Error('❌ Nenhum usuário ADMIN ou MANAGER encontrado no Railway!')
    }

    console.log(`👤 Usando userId: ${defaultUser.id} (${defaultUser.name} - ${defaultUser.role})\n`)

    // ═══════════════════════════════════════════════════════════════
    // PASSO 5: Copiar consignatarias (MySQL) → empresas (Railway)
    // ═══════════════════════════════════════════════════════════════
    console.log('📦 [5/7] Copiando "consignatarias" → "empresas"...')
    
    const [consignatarias] = await mysqlConnection.query<any[]>(
      'SELECT * FROM consignatarias ORDER BY id'
    )
    
    console.log(`   📊 ${consignatarias.length} consignatárias encontradas no MySQL`)
    
    let empresasCriadas = 0
    const consignatariaIdMap = new Map<number, number>() // Map: mysqlId → railwayId
    
    for (const consig of consignatarias) {
      try {
        const empresa = await railwayPrisma.empresa.create({
          data: {
            userId: defaultUser.id,
            nome: consig.razao_social ? consig.razao_social.trim() : (consig.nome ? consig.nome.trim() : 'Sem nome'),
            cnpj: consig.cnpj ? consig.cnpj.trim() : (consig.cgc ? consig.cgc.trim() : null),
            tipo: 'PUBLICO',
            telefone: consig.telefone ? consig.telefone.trim() : (consig.fone ? consig.fone.trim() : null),
            email: consig.email ? consig.email.trim() : null,
            contato: consig.contato ? consig.contato.trim() : null,
            cep: consig.cep ? consig.cep.trim() : null,
            rua: consig.rua ? consig.rua.trim() : (consig.endereco ? consig.endereco.trim() : null),
            numero: consig.numero ? consig.numero.trim() : null,
            bairro: consig.bairro ? consig.bairro.trim() : null,
            cidade: consig.cidade ? consig.cidade.trim() : null,
            uf: consig.uf ? consig.uf.trim() : null,
            ativo: true,
          }
        })
        
        // Mapear id do MySQL → id do Railway
        consignatariaIdMap.set(consig.id, empresa.id)
        
        empresasCriadas++
        console.log(`   ✅ [${empresasCriadas}/${consignatarias.length}] ${consig.razao_social || consig.nome} (MySQL ID: ${consig.id} → Railway ID: ${empresa.id})`)
      } catch (error: any) {
        console.log(`   ⚠️  Erro ao criar empresa: ${consig.razao_social || consig.nome}`)
        console.log(`       ${error.message}`)
      }
    }
    
    console.log(`   🎉 ${empresasCriadas} empresas criadas!\n`)

    // ═══════════════════════════════════════════════════════════════
    // PASSO 6: Copiar convenio (MySQL) → convenio (Railway)
    // ═══════════════════════════════════════════════════════════════
    console.log('📦 [6/7] Copiando "convenio" (MySQL) → "convenio" (Railway)...')
    
    const [convenios] = await mysqlConnection.query<any[]>(
      'SELECT * FROM convenio ORDER BY id'
    )
    
    console.log(`   📊 ${convenios.length} convênios encontrados no MySQL`)
    
    let conveniosCriados = 0
    
    for (const conv of convenios) {
      try {
        await railwayPrisma.convenio.create({
          data: {
            userId: defaultUser.id,
            codigo: conv.codigo ? conv.codigo.trim() : null,
            data: conv.data ? new Date(conv.data) : null,
            razao_soc: conv.razao_soc ? conv.razao_soc.trim() : 'Sem razão social',
            fantasia: conv.fantasia ? conv.fantasia.trim() : null,
            desconto: conv.desconto ? parseFloat(conv.desconto) : null,
            cgc: conv.cgc ? conv.cgc.trim() : null,
            ie: conv.ie ? conv.ie.trim() : null,
            cpf: conv.cpf ? conv.cpf.trim() : null,
            rg: conv.rg ? conv.rg.trim() : null,
            endereco: conv.endereco ? conv.endereco.trim() : null,
            bairro: conv.bairro ? conv.bairro.trim() : null,
            cep: conv.cep ? conv.cep.trim() : null,
            cidade: conv.cidade ? conv.cidade.trim() : null,
            uf: conv.uf ? conv.uf.trim() : null,
            fone: conv.fone ? conv.fone.trim() : null,
            fax: conv.fax ? conv.fax.trim() : null,
            contato: conv.contato ? conv.contato.trim() : null,
            agencia: conv.agencia ? conv.agencia.trim() : null,
            conta: conv.conta ? conv.conta.trim() : null,
            banco: conv.banco ? conv.banco.trim() : null,
            usuario: conv.usuario ? conv.usuario.trim() : null,
            senha: conv.senha ? conv.senha.trim() : null,
            parcelas: conv.parcelas || null,
            mensagem: conv.mensagem ? conv.mensagem.trim() : null,
            libera: conv.libera ? conv.libera.trim() : null,
            cnpj: conv.cnpj ? conv.cnpj.trim() : (conv.cgc ? conv.cgc.trim() : null),
            email: conv.email ? conv.email.trim() : null,
            tipo: conv.tipo ? conv.tipo.trim() : null,
          }
        })
        conveniosCriados++
        console.log(`   ✅ [${conveniosCriados}/${convenios.length}] ${conv.razao_soc}`)
      } catch (error: any) {
        console.log(`   ⚠️  Erro ao criar convênio: ${conv.razao_soc}`)
        console.log(`       ${error.message}`)
      }
    }
    
    console.log(`   🎉 ${conveniosCriados} convênios criados!\n`)

    // ═══════════════════════════════════════════════════════════════
    // PASSO 7: Copiar socios (MySQL) → socios (Railway)
    // ═══════════════════════════════════════════════════════════════
    console.log('📦 [7/7] Copiando "socios" (MySQL) → "socios" (Railway)...')
    
    const [socios] = await mysqlConnection.query<any[]>(
      'SELECT * FROM socios ORDER BY id'
    )
    
    console.log(`   📊 ${socios.length} sócios encontrados no MySQL\n`)
    
    let sociosComEmpresa = 0
    let sociosSemEmpresa = 0
    
    // Mapear sócios usando o campo 'tipo'
    const sociosMapeados = socios.map((socio) => {
      let empresaId: number | null = null
      
      // Regra: tipo="1" → PREFEITURA, tipo="3" → FUNDO, outros → null
      if (socio.tipo === '1' && consignatariaIdMap.has(2)) {
        // tipo="1" → PREFEITURA MUNICIPAL (id=2 no MySQL)
        empresaId = consignatariaIdMap.get(2)!
        sociosComEmpresa++
      } else if (socio.tipo === '3' && consignatariaIdMap.has(1)) {
        // tipo="3" → FUNDO DE PREVIDENCIA (id=1 no MySQL)
        empresaId = consignatariaIdMap.get(1)!
        sociosComEmpresa++
      } else {
        sociosSemEmpresa++
        empresaId = null
      }
      
      return {
        userId: defaultUser.id,
        nome: socio.nome ? socio.nome.trim() : 'Sem nome',
        cpf: socio.cpf ? socio.cpf.trim() : null,
        rg: socio.rg ? socio.rg.trim() : null,
        matricula: socio.matricula ? socio.matricula.trim() : null,
        empresaId: empresaId,
        funcao: socio.funcao ? socio.funcao.trim() : null,
        lotacao: socio.lotacao ? socio.lotacao.trim() : null,
        endereco: socio.endereco ? socio.endereco.trim() : null,
        bairro: socio.bairro ? socio.bairro.trim() : null,
        cep: socio.cep ? socio.cep.trim() : null,
        cidade: socio.cidade ? socio.cidade.trim() : null,
        uf: socio.uf ? socio.uf.trim() : null,
        telefone: socio.telefone ? socio.telefone.trim() : null,
        celular: socio.celular ? socio.celular.trim() : null,
        email: socio.email ? socio.email.trim() : null,
        dataNascimento: socio.data_nascimento ? new Date(socio.data_nascimento) : null,
        dataAdmissao: socio.data_admissao ? new Date(socio.data_admissao) : null,
        ativo: socio.ativo !== undefined ? Boolean(socio.ativo) : true,
      }
    })
    
    console.log(`   📊 Estatísticas antes da criação:`)
    console.log(`      - Com empresa: ${sociosComEmpresa}`)
    console.log(`      - Sem empresa: ${sociosSemEmpresa}\n`)
    
    // Inserir em lotes usando createMany
    const batchSize = 500
    let totalCriados = 0
    
    for (let i = 0; i < sociosMapeados.length; i += batchSize) {
      const batch = sociosMapeados.slice(i, i + batchSize)
      
      try {
        const result = await railwayPrisma.socio.createMany({
          data: batch,
          skipDuplicates: true
        })
        
        totalCriados += result.count
        console.log(`   ✅ [${totalCriados}/${socios.length}] Sócios criados...`)
      } catch (error: any) {
        console.log(`   ⚠️  Erro no lote ${i}-${i + batchSize}:`, error.message)
      }
    }
    
    console.log(`   🎉 ${totalCriados} sócios criados!\n`)

    // ═══════════════════════════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════')
    console.log('📊 RESUMO DA MIGRAÇÃO')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`✅ Empresas criadas:     ${empresasCriadas}/${consignatarias.length}`)
    console.log(`✅ Convênios criados:    ${conveniosCriados}/${convenios.length}`)
    console.log(`✅ Sócios criados:       ${totalCriados}/${socios.length}`)
    console.log(`   - Com empresa:         ${sociosComEmpresa}`)
    console.log(`   - Sem empresa:         ${sociosSemEmpresa}`)
    console.log(`👤 UserID utilizado:     ${defaultUser.id}`)
    console.log(`👤 Usuário:              ${defaultUser.name} (${defaultUser.role})`)
    console.log('═══════════════════════════════════════════════════════════')
    console.log('🎉 Migração concluída com sucesso!\n')

  } catch (error) {
    console.error('\n❌ Erro durante migração:', error)
    throw error
  } finally {
    // Desconectar
    if (mysqlConnection) {
      await mysqlConnection.end()
      console.log('🔌 MySQL desconectado')
    }
    await railwayPrisma.$disconnect()
    console.log('🔌 Railway desconectado')
  }
}

// Executar
migrateConsignatariasConvenios()
  .catch((error) => {
    console.error('💥 Falha fatal:', error)
    process.exit(1)
  })

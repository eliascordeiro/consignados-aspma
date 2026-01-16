import mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrate() {
  const connection = await mysql.createConnection({
    host: '200.98.112.240',
    port: 3306,
    user: 'eliascordeiro',
    password: 'D24m0733@!',
    database: 'aspma',
  })

  try {
    console.log('🔄 Conectado ao MySQL remoto...')

    // Migrar Consignatárias (empresas)
    console.log('\n📦 Migrando consignatárias → empresas...')
    const [consignatariasRows] = await connection.execute('SELECT * FROM consignatarias')
    const consignatarias = consignatariasRows as any[]
    
    for (const cons of consignatarias) {
      await prisma.empresa.create({
        data: {
          id: cons.id,
          nome: cons.nome || '',
          cnpj: cons.cnpj,
          tipo: 'PRIVADA',
          telefone: cons.telefone,
          email: cons.email,
          ativo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    }
    console.log(`✅ ${consignatarias.length} consignatárias migradas`)

    // Migrar Sócios
    console.log('\n👥 Migrando sócios...')
    const [sociosRows] = await connection.execute('SELECT * FROM socios')
    const socios = sociosRows as any[]
    
    let count = 0
    for (const socio of socios) {
      try {
        await prisma.socio.create({
          data: {
            nome: socio.associado || '',
            cpf: socio.cpf,
            rg: socio.rg,
            matricula: socio.matricula,
            empresaId: socio.consignataria || null,
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
            autorizado: socio.autorizado === 1 || socio.autorizado === true,
            sexo: socio.sexo,
            estadoCivil: socio.est_civil,
            numCompras: socio.ncompras,
            tipo: socio.tipo,
            agencia: socio.agencia,
            conta: socio.conta,
            banco: socio.banco,
            devolucao: socio.devolucao === 1 || socio.devolucao === true,
            bloqueio: socio.bloqueio === 1 || socio.bloqueio === true,
            motivoBloqueio: socio.motivo,
            codTipo: socio.codtipo?.toString(),
            senha: socio.senha?.toString(),
            dataExclusao: socio.data_exclusao,
            motivoExclusao: socio.motivo_exclusao,
            ativo: !socio.data_exclusao,
            createdAt: socio.data || new Date(),
            updatedAt: new Date(),
          },
        })
        count++
        if (count % 100 === 0) {
          console.log(`  Processados ${count} sócios...`)
        }
      } catch (error: any) {
        console.error(`  Erro ao migrar sócio ${socio.matricula || socio.associado}:`, error.message)
      }
    }
    console.log(`✅ ${count} sócios migrados`)

    // Migrar Convênios
    console.log('\n📋 Migrando convênios...')
    const [conveniosRows] = await connection.execute('SELECT * FROM convenio')
    const convenios = conveniosRows as any[]
    
    count = 0
    for (const conv of convenios) {
      try {
        await prisma.convenio.create({
          data: {
            codigo: conv.codigo,
            data: conv.data,
            razao_soc: conv.razao_soc || '',
            fantasia: conv.fantasia,
            desconto: conv.desconto,
            cgc: conv.cgc,
            ie: conv.ie,
            cpf: conv.cpf,
            rg: conv.rg,
            endereco: conv.endereco,
            bairro: conv.bairro,
            cep: conv.cep,
            cidade: conv.cidade,
            uf: conv.uf,
            fone: conv.fone,
            fax: conv.fax,
            contato: conv.contato,
            agencia: conv.agencia,
            conta: conv.conta,
            banco: conv.banco,
            usuario: conv.usuario,
            senha: conv.senha,
            parcelas: conv.parcelas,
            mensagem: conv.mensagem,
            libera: conv.libera,
            email: conv.email,
            chave: conv.chave,
            convenio: conv.convenio?.toString(),
            ativo: true,
            createdAt: conv.data || new Date(),
            updatedAt: new Date(),
          },
        })
        count++
        if (count % 50 === 0) {
          console.log(`  Processados ${count} convênios...`)
        }
      } catch (error: any) {
        console.error(`  Erro ao migrar convênio ${conv.codigo || conv.razao_soc}:`, error.message)
      }
    }
    console.log(`✅ ${count} convênios migrados`)

    console.log('\n🎉 Migração concluída com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro na migração:', error)
  } finally {
    await connection.end()
    await prisma.$disconnect()
  }
}

migrate()

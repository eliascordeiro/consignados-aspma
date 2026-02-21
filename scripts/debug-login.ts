import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugLogin() {
  console.log('🔍 Debug do login...\n')

  const usuario = 'teste'
  const senha = 'teste123'

  const convenio = await prisma.convenio.findFirst({
    where: {
      usuario: usuario,
      ativo: true,
    },
  })

  console.log('Convênio encontrado:', convenio ? 'SIM' : 'NÃO')
  
  if (convenio) {
    console.log('\n📋 Dados do convênio:')
    console.log('  - ID:', convenio.id)
    console.log('  - Usuario:', `"${convenio.usuario}"`)
    console.log('  - Senha no banco:', `"${convenio.senha}"`)
    console.log('  - Senha testada:', `"${senha}"`)
    console.log('  - Senhas iguais?:', convenio.senha === senha ? '✅ SIM' : '❌ NÃO')
    console.log('  - Ativo:', convenio.ativo)
    
    if (convenio.senha !== senha) {
      console.log('\n⚠️  PROBLEMA ENCONTRADO:')
      console.log(`  - Senha no banco tem ${convenio.senha?.length || 0} caracteres`)
      console.log(`  - Senha testada tem ${senha.length} caracteres`)
      console.log(`  - Senha no banco (bytes):`, Buffer.from(convenio.senha || '').toString('hex'))
      console.log(`  - Senha testada (bytes):`, Buffer.from(senha).toString('hex'))
    }
  }

  await prisma.$disconnect()
}

debugLogin()

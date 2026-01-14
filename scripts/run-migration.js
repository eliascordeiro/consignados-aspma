const { execSync } = require('child_process')

console.log('🚀 Executando migração do Prisma...\n')

try {
  const result = execSync('npx prisma migrate dev --name add_empresas_locais_autorizacoes', {
    cwd: __dirname + '/..',
    stdio: 'inherit',
    input: 'y\n'
  })
  
  console.log('\n✅ Migração concluída com sucesso!')
  
} catch (error) {
  console.error('❌ Erro na migração:', error.message)
  process.exit(1)
}

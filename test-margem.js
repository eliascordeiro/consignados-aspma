// Script de teste para consulta de margem ZETRA
// Uso: node test-margem.js

const https = require('https');

// Configuração do ambiente
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const MATRICULA = '2221';

async function buscarSocio(matricula) {
  console.log(`\n🔍 Buscando sócio com matrícula: ${matricula}...`);
  
  const response = await fetch(`${BASE_URL}/api/socios?matricula=${matricula}`);
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar sócio: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data || data.length === 0) {
    throw new Error('Sócio não encontrado');
  }
  
  const socio = data[0];
  console.log(`✅ Sócio encontrado: ${socio.associado} (ID: ${socio.id})`);
  console.log(`   Matrícula: ${socio.matricula}`);
  console.log(`   Tipo: ${socio.tipo} ${socio.tipo === 1 ? '(Consignatária - ZETRA)' : '(Banco de Dados)'}`);
  
  return socio;
}

async function consultarMargem(socioId) {
  console.log(`\n📊 Consultando margem para sócio ID ${socioId}...`);
  
  const startTime = Date.now();
  
  const response = await fetch(`${BASE_URL}/api/socios/${socioId}/margem`);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro na consulta: ${error.error || response.status}`);
  }
  
  const data = await response.json();
  
  console.log(`✅ Consulta concluída em ${duration}s`);
  console.log('\n📋 RESULTADO DA CONSULTA:');
  console.log('─'.repeat(50));
  console.log(`Matrícula: ${data.matricula}`);
  console.log(`Associado: ${data.associado}`);
  console.log(`Margem: R$ ${data.margem.toFixed(2)}`);
  console.log(`Tipo: ${data.tipo}`);
  console.log(`Fonte: ${data.fonte}`);
  
  if (data.aviso) {
    console.log(`⚠️  Aviso: ${data.aviso}`);
  }
  
  console.log('─'.repeat(50));
  
  return data;
}

async function testarConsultaMargem() {
  try {
    console.log('🧪 TESTE DE CONSULTA DE MARGEM ZETRA');
    console.log('═'.repeat(50));
    
    // Busca o sócio pela matrícula
    const socio = await buscarSocio(MATRICULA);
    
    // Consulta a margem
    const margem = await consultarMargem(socio.id);
    
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
    
    if (margem.tipo === 'zetra' && margem.fonte === 'tempo_real') {
      console.log('🎯 Margem consultada diretamente do webservice ZETRA (SOAP)');
    } else if (margem.fonte === 'fallback') {
      console.log('⚠️  ZETRA indisponível - usando valor do banco de dados');
    } else {
      console.log('📦 Margem do banco de dados (tipo diferente de consignatária)');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:');
    console.error(error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Executa o teste
testarConsultaMargem();

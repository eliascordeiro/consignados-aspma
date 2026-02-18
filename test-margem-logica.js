/**
 * Teste da lógica de cálculo de margem
 * Cenário: Hoje é 18/02/2026
 */

// Simular data: 18/02/2026
const hoje = new Date(2026, 1, 18) // mês 1 = fevereiro (0-indexed)
console.log('📅 Hoje:', hoje.toLocaleDateString('pt-BR'))
console.log('📅 Dia:', hoje.getDate())
console.log('')

// 1. calcularDataCorte() - determina qual mês deve ser considerado
function calcularDataCorte() {
  const dia = hoje.getDate()
  let mes = hoje.getMonth() + 1 // getMonth() retorna 0-11, precisamos 1-12
  let ano = hoje.getFullYear()

  console.log('🔍 calcularDataCorte():')
  console.log('  - Dia atual:', dia)
  console.log('  - Mês atual (1-12):', mes)
  console.log('  - Dia > 9?', dia > 9)

  if (dia > 9) {
    console.log('  - SIM, considera mês seguinte')
    if (mes === 12) {
      mes = 1
      ano = ano + 1
    } else {
      mes = mes + 1
    }
  } else {
    console.log('  - NÃO, considera mês atual')
  }

  console.log('  - Data de corte final:', `${String(mes).padStart(2, '0')}/${ano}`)
  return { mes, ano }
}

const dataCorte = calcularDataCorte()
console.log('')

// 2. calcularPrimeiroVencimento() - determina quando vence a primeira parcela
function calcularPrimeiroVencimento() {
  const dia = hoje.getDate()
  let mes = hoje.getMonth()
  let ano = hoje.getFullYear()

  console.log('🔍 calcularPrimeiroVencimento():')
  console.log('  - Dia atual:', dia)
  console.log('  - Mês atual (0-11):', mes)
  console.log('  - Dia > 9?', dia > 9)

  if (dia > 9) {
    console.log('  - SIM, primeira parcela vence no mês seguinte')
    if (mes === 11) {
      mes = 0
      ano = ano + 1
    } else {
      mes = mes + 1
    }
  } else {
    console.log('  - NÃO, primeira parcela vence no mês atual')
  }

  const vencimento = new Date(ano, mes, 1)
  console.log('  - Primeiro vencimento:', vencimento.toLocaleDateString('pt-BR'))
  return vencimento
}

const primeiroVencimento = calcularPrimeiroVencimento()
console.log('')

// 3. Verificar se a data de corte e o vencimento coincidem
console.log('✅ Verificação:')
console.log('  - Data de corte para cálculo:', `${String(dataCorte.mes).padStart(2, '0')}/${dataCorte.ano}`)
console.log('  - Vencimento da primeira parcela:', primeiroVencimento.toLocaleDateString('pt-BR'))
console.log('  - Mês do vencimento:', primeiroVencimento.getMonth() + 1) // +1 porque getMonth() é 0-indexed
console.log('  - São iguais?', primeiroVencimento.getMonth() + 1 === dataCorte.mes ? '✅ SIM' : '❌ NÃO')
console.log('')

// 4. Simular query de parcelas
console.log('🔍 Query de parcelas (calcularDescontosDoMes):')
const queryStart = new Date(dataCorte.ano, dataCorte.mes - 1, 1)
const queryEnd = new Date(dataCorte.ano, dataCorte.mes, 1)
console.log('  - WHERE dataVencimento >=', queryStart.toLocaleDateString('pt-BR'))
console.log('  - WHERE dataVencimento <', queryEnd.toLocaleDateString('pt-BR'))
console.log('')

// 5. Verificar se a parcela criada será incluída
console.log('✅ Parcela criada hoje será incluída na query?')
console.log('  - Vencimento da parcela:', primeiroVencimento.toLocaleDateString('pt-BR'))
console.log('  - Vencimento >= queryStart?', primeiroVencimento >= queryStart ? '✅ SIM' : '❌ NÃO')
console.log('  - Vencimento < queryEnd?', primeiroVencimento < queryEnd ? '✅ SIM' : '❌ NÃO')
console.log('  - SERÁ INCLUÍDA?', (primeiroVencimento >= queryStart && primeiroVencimento < queryEnd) ? '✅✅✅ SIM' : '❌❌❌ NÃO')
console.log('')

// 6. Cenário completo
console.log('📊 CENÁRIO COMPLETO:')
console.log('  1. Limite do sócio: R$ 1.000,00')
console.log('  2. Cria venda de R$ 10,00 (1 parcela)')
console.log('  3. Vencimento da parcela: ' + primeiroVencimento.toLocaleDateString('pt-BR'))
console.log('  4. Mês de referência (data de corte): ' + `${String(dataCorte.mes).padStart(2, '0')}/${dataCorte.ano}`)
console.log('  5. Parcela será contabilizada? ' + ((primeiroVencimento >= queryStart && primeiroVencimento < queryEnd) ? '✅ SIM' : '❌ NÃO'))
console.log('  6. Novo limite: R$ 1.000,00 - R$ 10,00 = R$ 990,00')

/**
 * Calcula o mês/ano de referência para cálculo de margem.
 *
 * Regra (AS200.PRG): se dia atual > diaCorte, avança para o próximo mês.
 * O diaCorte vem do campo `diaCorte` da tabela `empresas` (consignatária do sócio).
 * Valor padrão: 9 (original hardcoded no sistema legado).
 */
export function calcularDataCorte(diaCorte = 9): { mes: number; ano: number } {
  const hoje = new Date()
  const dia = hoje.getDate()
  let mes = hoje.getMonth() + 1 // 1-12
  let ano = hoje.getFullYear()

  if (dia > diaCorte) {
    if (mes === 12) {
      mes = 1
      ano = ano + 1
    } else {
      mes = mes + 1
    }
  }

  return { mes, ano }
}

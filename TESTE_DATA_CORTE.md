# Teste da Regra de Data de Corte - Dia 9

## 📋 Regra Implementada

**Data de Corte: Dia 9 de cada mês**

- ✅ **Dia 1 a 9**: Primeira parcela vence no **mês atual** (dia 10)
- ✅ **Dia 10 a 31**: Primeira parcela vence no **mês seguinte** (dia 10)

## 🧪 Exemplos de Teste

### Cenário 1: Venda no dia 5 de Fevereiro
```
Data da venda: 05/02/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 10/02/2026 (mês atual)
- Parcela 2: 10/03/2026
- Parcela 3: 10/04/2026
```

### Cenário 2: Venda no dia 9 de Fevereiro
```
Data da venda: 09/02/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 10/02/2026 (mês atual - limite)
- Parcela 2: 10/03/2026
- Parcela 3: 10/04/2026
```

### Cenário 3: Venda no dia 10 de Fevereiro
```
Data da venda: 10/02/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 10/03/2026 (próximo mês)
- Parcela 2: 10/04/2026
- Parcela 3: 10/05/2026
```

### Cenário 4: Venda no dia 25 de Dezembro
```
Data da venda: 25/12/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 10/01/2027 (próximo ano)
- Parcela 2: 10/02/2027
- Parcela 3: 10/03/2027
```

## 💻 Código Implementado

### API do Portal de Convênios
```typescript
function calcularPrimeiroVencimento(): Date {
  const hoje = new Date()
  const dia = hoje.getDate()
  let mes = hoje.getMonth()
  let ano = hoje.getFullYear()

  // Se passou do dia 9, primeira parcela vence no mês seguinte
  if (dia > 9) {
    if (mes === 11) { // dezembro (0-indexed)
      mes = 0 // janeiro
      ano = ano + 1
    } else {
      mes = mes + 1
    }
  }

  // Define sempre para o dia 10 do mês
  return new Date(ano, mes, 10)
}
```

### Criação das Parcelas
```typescript
const primeiroVencimento = calcularPrimeiroVencimento()
const parcelas = []

for (let i = 0; i < quantidadeParcelas; i++) {
  const dataVencimento = new Date(primeiroVencimento)
  dataVencimento.setMonth(primeiroVencimento.getMonth() + i)

  parcelas.push({
    vendaId: venda.id,
    numeroParcela: i + 1,
    dataVencimento,
    valor: valorParcela,
    baixa: 'N',
  })
}
```

## ✅ Validação

Para testar, crie vendas em diferentes dias do mês e verifique:

1. **Antes do dia 9**: Primeira parcela no mês atual
2. **Dia 9**: Primeira parcela no mês atual  
3. **Depois do dia 9**: Primeira parcela no mês seguinte
4. **Virada de ano**: Primeira parcela em janeiro do próximo ano

## 🔍 Como Verificar

Após criar uma venda:
1. Acesse o banco de dados
2. Query: `SELECT numeroParcela, dataVencimento FROM parcelas WHERE vendaId = '{venda_id}' ORDER BY numeroParcela`
3. Confirme que a primeira parcela está no mês correto
4. Confirme que as demais parcelas são mensais subsequentes

## 📝 Observações

- Todas as parcelas vencem sempre no **dia 10** do mês
- A contagem de meses usa JavaScript Date (0-indexed)
- Funciona corretamente na virada de ano
- Regra aplicada **apenas no portal de convênios** (criação de vendas)

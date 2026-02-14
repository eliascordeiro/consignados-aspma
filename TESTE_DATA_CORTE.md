# Teste da Regra de Data de Corte - Dia 9

## 📋 Regra Implementada

**Data de Corte: Dia 9 de cada mês**

- ✅ **Dia 1 a 9**: Primeira parcela vence no **mês atual** (dia 01)
- ✅ **Dia 10 a 31**: Primeira parcela vence no **mês seguinte** (dia 01)

**IMPORTANTE**: Usa sempre dia 01 do mês (padrão AS200.PRG) porque:
- Para o convênio, interessa o **MÊS** de desconto, não o dia específico
- Evita problemas com meses de tamanhos diferentes (28, 29, 30, 31 dias)
- Compra no dia 31 não causará erro ao calcular vencimentos

## 🧪 Exemplos de Teste

### Cenário 1: Venda no dia 5 de Fevereiro
```
Data da venda: 05/02/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 01/02/2026 (mês atual)
- Parcela 2: 01/03/2026
- Parcela 3: 01/04/2026
```

### Cenário 2: Venda no dia 9 de Fevereiro
```
Data da venda: 09/02/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 01/02/2026 (mês atual - limite)
- Parcela 2: 01/03/2026
- Parcela 3: 01/04/2026
```

### Cenário 3: Venda no dia 10 de Fevereiro
```
Data da venda: 10/02/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 01/03/2026 (próximo mês)
- Parcela 2: 01/04/2026
- Parcela 3: 01/05/2026
```

### Cenário 4: Venda no dia 31 de Janeiro (caso crítico)
```
Data da venda: 31/01/2026
Quantidade de parcelas: 12

Resultado esperado:
- Parcela 1: 01/02/2026 (próximo mês - dia > 9)
- Parcela 2: 01/03/2026
- Parcela 3: 01/04/2026
- Parcela 4: 01/05/2026
- ...
- Parcela 12: 01/01/2027

✅ SEM ERROS: Usa sempre dia 01, evita problema com Fevereiro (28/29 dias)
```

### Cenário 5: Venda no dia 25 de Dezembro
```
Data da venda: 25/12/2026
Quantidade de parcelas: 3

Resultado esperado:
- Parcela 1: 01/01/2027 (próximo ano)
- Parcela 2: 01/02/2027
- Parcela 3: 01/03/2027
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

  // Define sempre para o dia 01 do mês (padrão AS200.PRG)
  return new Date(ano, mes, 1)
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

1. **Antes do dia 9**: Primeira parcela no mês atual (dia 01)
2. **Dia 9**: Primeira parcela no mês atual (dia 01)
3. **Depois do dia 9**: Primeira parcela no mês seguinte (dia 01)
4. **Dia 31**: Sem problemas com meses curtos (sempre dia 01)
5. **Virada de ano**: Primeira parcela em janeiro do próximo ano (dia 01)

## 🔍 Como Verificar

Após criar uma venda:
1. Acesse o banco de dados
2. Query: `SELECT numeroParcela, dataVencimento FROM parcelas WHERE vendaId = '{venda_id}' ORDER BY numeroParcela`
3. Confirme que a primeira parcela está no mês correto
4. Confirme que todas as parcelas estão no dia 01 do mês
5. Confirme que as parcelas são mensais subsequentes

## 📝 Observações

- Todas as parcelas vencem sempre no **dia 01** do mês (padrão AS200.PRG)
- A contagem de meses usa JavaScript Date (0-indexed)
- Funciona corretamente na virada de ano
- **Não há problemas** com meses de tamanhos diferentes
- Regra aplicada **apenas no portal de convênios** (criação de vendas)

## ⚠️ Por que Dia 01?

No programa AS200.PRG original, era usado sempre dia 01 porque:

1. **Foco no mês**: Para o convênio, o importante é o MÊS de desconto, não o dia
2. **Segurança**: Evita erros com meses de 28, 29, 30 ou 31 dias
3. **Consistência**: Mesmo padrão em todos os meses do ano
4. **Compatibilidade**: Mantém compatibilidade com sistema legado

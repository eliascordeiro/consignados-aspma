# Ordem de Execução dos Scripts de Migração

## Visão Geral

A migração do MySQL legado para o PostgreSQL Railway deve ser executada em 3 passos sequenciais:

```
MySQL (Legado)  →  PostgreSQL (Railway)
   aspma             consignados
```

---

## 📋 Passo a Passo

### **PASSO 1: Migrar Estrutura Base**
```bash
npx tsx app/scripts/migrate-all-to-railway.ts
```

**O que faz:**
- ✅ Migra empresas
- ✅ Migra consignatárias
- ✅ Migra convênios
- ✅ Migra sócios (todos os tipos: ativos, pensionistas, etc.)
- ✅ Cria estrutura base do sistema

**Resultado esperado:**
- Empresas criadas
- Convênios mapeados
- Sócios migrados com codTipo correto

---

### **PASSO 2: Migrar Vendas e Parcelas (Primeira Tentativa)**
```bash
npx tsx app/scripts/migrate-vendas-parcelas-v2.ts
```

**O que faz:**
- ✅ Migra vendas do MySQL
- ✅ Migra parcelas associadas
- ⚠️ **BUG:** Agrupa por `matricula-convenio` (deveria ser `matricula-convenio-sequencia`)

**Problemas identificados:**
1. **Agrupamento incorreto:** Múltiplas vendas com mesma matrícula/convênio são mescladas em uma só
2. **numeroVenda incorreto:** Usa hash ao invés da sequência real do MySQL
3. **Parcelas perdidas:** Como vendas são mescladas, parcelas não podem ser associadas corretamente

**Resultado:**
- ✅ Sócios migrados
- ✅ Vendas criadas (mas estrutura incorreta)
- ❌ Parcelas **não criadas** ou parcialmente criadas

---

### **PASSO 3: Corrigir Vendas e Parcelas** ⭐ NOVO
```bash
npx tsx app/scripts/migrate-corrigir-vendas-parcelas.ts
```

**O que faz:**
- ✅ Agrupa por `matricula-convenio-sequencia` (correção do bug)
- ✅ Usa `sequencia` real do MySQL como `numeroVenda`
- ✅ Cria parcelas corretamente para cada venda
- ✅ Lógica de baixa correta (string vazia vs preenchida)
- ✅ Incremental: não duplica dados existentes

**Correções aplicadas:**

| **Antes (BUG)**                          | **Depois (CORRETO)**                    |
|------------------------------------------|-----------------------------------------|
| Agrupa por `matricula-convenio`          | Agrupa por `matricula-convenio-sequencia` |
| `numeroVenda = hash(dados)`              | `numeroVenda = sequencia do MySQL`      |
| Parcelas não criadas                     | Parcelas criadas corretamente           |
| `baixa == '1'` (comparação errada)       | `baixa != ''` (string vazia)            |

**Resultado esperado:**
- ✅ Todas as vendas únicas identificadas
- ✅ Todas as parcelas criadas
- ✅ Baixas registradas corretamente

---

## 🔍 Validação

Após executar os 3 passos, validar com:

### 1. Verificar Parcelas de Pensionistas
```bash
npx tsx app/scripts/calcular-diferenca-exata-pensionistas.ts
```

**Resultado esperado:**
- MySQL: 2.453 parcelas, R$ 1.174.798,31
- PostgreSQL: 2.453 parcelas, R$ 1.174.798,31 (ou R$ 1.173.623,60 se diferença aceitável)

### 2. Investigar Vendas Individuais
```bash
npx tsx app/scripts/investigar-vendas-nao-reconhecidas.ts
```

**Resultado esperado:**
- Taxa de migração: 100% (ou próximo)
- Todas as sequências migradas
- Parcelas associadas corretamente

---

## 📊 Exemplo: Matrícula 8170

### Antes da Correção (Passo 2):
```
MySQL:
  - Venda seq 10 (3 parcelas)
  - Venda seq 11 (2 parcelas)
  - Venda seq 13 (1 parcela)

PostgreSQL (BUG):
  - Venda hash123 → 0 parcelas ❌
```

### Depois da Correção (Passo 3):
```
MySQL:
  - Venda seq 10 (3 parcelas)
  - Venda seq 11 (2 parcelas)
  - Venda seq 13 (1 parcela)

PostgreSQL (CORRETO):
  - Venda 10 → 3 parcelas ✅
  - Venda 11 → 2 parcelas ✅
  - Venda 13 → 1 parcela ✅
```

---

## ⚠️ Observações Importantes

### Diferença de R$ 1.174,71 (0.1%)

**Valores:**
- MySQL Legado: R$ 1.174.798,31
- PostgreSQL Railway: R$ 1.173.623,60
- Diferença: R$ 1.174,71

**Possíveis causas:**
1. Parcelas com baixa preenchida após a consulta
2. Arredondamentos em valores decimais
3. Parcelas excluídas no legado mas ainda na base
4. Filtros de data diferentes (data de corte)

**Ação recomendada:**
- Investigar as 10-15 parcelas com maior diferença
- Verificar se há parcelas com `baixa` preenchida no intervalo
- Comparar totais por tipo (codTipo 3 vs 4)

---

## 🔄 Execução Incremental

O **Passo 3** pode ser executado múltiplas vezes:
- ✅ Verifica se venda já existe antes de criar
- ✅ Verifica se parcela já existe antes de criar
- ✅ Atualiza apenas se valores divergirem
- ✅ Não duplica dados

**Logs de progresso:**
```
📊 Progresso: 500/2.453 (20.4%)
📊 Progresso: 1.000/2.453 (40.8%)
...
```

---

## 📚 Documentação Relacionada

- **[ANALISE_CAUSA_RAIZ_PARCELAS_FALTANTES.md](../../ANALISE_CAUSA_RAIZ_PARCELAS_FALTANTES.md)**: Análise completa do bug de agrupamento
- **[MIGRATION_GUIDE.md](../../MIGRATION_GUIDE.md)**: Guia geral de migração
- **[RAILWAY_MIGRATION_REPORT.md](../../RAILWAY_MIGRATION_REPORT.md)**: Relatório da migração Railway

---

## 🎯 Próximos Passos

Após a migração completa:

1. **Atualizar endpoint de sincronização:**
   - Arquivo: `app/src/app/api/relatorios/sincronizar-mysql/route.ts`
   - Aplicar mesmas correções do Passo 3
   - Testar com: `POST /api/relatorios/sincronizar-mysql`

2. **Criar rotina de sincronização periódica:**
   - Cron job para rodar diariamente
   - Sincronizar apenas dados novos/alterados
   - Monitorar discrepâncias

3. **Migrar dados históricos:**
   - Executar para todos os meses
   - Validar totais por período
   - Arquivar relatórios de comparação

---

*Última atualização: 7 de março de 2026*

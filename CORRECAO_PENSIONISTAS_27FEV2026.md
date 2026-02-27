# ✅ CORREÇÃO: Relatório de Pensionistas - PostgreSQL

**Data**: 27/02/2026  
**Problema**: Valores do PostgreSQL menores que MySQL/LEGADO  
**Causa Raiz**: Filtro indevido por `userId`  
**Status**: ✅ **CORRIGIDO**

---

## 📊 DIFERENÇAS REPORTADAS

| Mês | PostgreSQL (ANTES) | MySQL/LEGADO | Diferença |
|-----|-------------------|--------------|-----------|
| Fevereiro | R$ 1.156.949,56 | R$ 1.157.488,23 | -R$ 538,67 |
| Março | R$ 1.163.928,32 | R$ 1.165.431,43 | -R$ 1.503,11 |

**Total de diferença**: ~R$ 2.041,78

---

## 🔍 CAUSA RAIZ IDENTIFICADA

### AS302.PRG (Legado - MySQL):
```prg
iQuery := oServer:Query("
  SELECT parcelas.*, socios.codtipo 
  FROM parcelas 
  LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) 
  WHERE month(parcelas.vencimento) = "+left(nPeriodo,02)+" 
    AND year(parcelas.vencimento) = "+right(nPeriodo,04)+" 
    AND TRIM(parcelas.baixa) = '' 
    AND (socios.codtipo = '3' OR socios.codtipo = '4') 
  ORDER BY parcelas.associado, parcelas.matricula, parcelas.sequencia, parcelas.nrseq
")
```
**❌ NÃO há filtro por usuário - traz TODOS os pensionistas do sistema**

### PostgreSQL (ANTES da correção):
```typescript
const where: any = {
  dataVencimento: { gte: dataInicio, lte: dataFim },
  venda: {
    userId: dataUserId,  // ❌ FILTRAVA APENAS O USUÁRIO LOGADO!
  },
};

const vendaFilter: any = { 
  userId: dataUserId  // ❌ FILTRO DUPLICADO!
};
```
**❌ Filtrava apenas parcelas do usuário logado (elias157508@gmail.com)**

---

## ✅ CORREÇÃO APLICADA

### Arquivo: `/app/src/app/api/relatorios/debitos-socios/route.ts`

#### 1️⃣ Removido filtro de userId no WHERE principal:
```typescript
// ANTES:
const where: any = {
  dataVencimento: { gte: dataInicio, lte: dataFim },
  venda: {
    userId: dataUserId,  // ❌ REMOVIDO
  },
};

// DEPOIS:
const where: any = {
  dataVencimento: { gte: dataInicio, lte: dataFim },
  // ✅ SEM filtro de userId - traz TODOS os pensionistas
};
```

#### 2️⃣ Removido filtro de userId no vendaFilter:
```typescript
// ANTES:
const vendaFilter: any = { userId: dataUserId };  // ❌ REMOVIDO

// DEPOIS:
const vendaFilter: any = {};  // ✅ Vazio - sem filtro de usuário
```

---

## 🎯 RESULTADO ESPERADO

Após a correção, o endpoint `/api/relatorios/debitos-socios` com parâmetro `tipoSocio=pensionistas` deve:

1. ✅ Trazer **TODAS** as parcelas de pensionistas do sistema (tipos 3 e 4)
2. ✅ **Independente** do usuário que registrou a venda
3. ✅ Filtrar apenas por:
   - Período (mês/ano)
   - Convênio (opcional)
   - Baixa vazia (`TRIM(baixa) = ''`)
   - Tipo de sócio (3 ou 4)

**Valores PostgreSQL devem ficar iguais ao MySQL/LEGADO**:
- Fevereiro: ~R$ 1.157.488,23
- Março: ~R$ 1.165.431,43

---

## 🧪 COMO TESTAR

### 1. Acessar o relatório:
```
http://localhost:3000/cliente/relatorios/pensionistas
```

### 2. Selecionar o período:
- **Mês-Ano**: 2026-02 (fevereiro) ou 2026-03 (março)
- **Formato**: PDF, Excel ou CSV

### 3. Verificar o total:
- Deve aparecer no rodapé do relatório
- Comparar com os valores do MySQL/LEGADO

### 4. Query direta (opcional):
```sql
-- PostgreSQL
SELECT SUM(p.valor) as total_pensionistas
FROM "Parcela" p
INNER JOIN "Venda" v ON p."vendaId" = v.id
INNER JOIN "Socio" s ON v."socioId" = s.id
WHERE p."dataVencimento" >= '2026-03-01' 
  AND p."dataVencimento" < '2026-04-01'
  AND (p.baixa IS NULL OR p.baixa = '' OR p.baixa = ' ')
  AND s."codTipo" IN (3, 4);
```

---

## 📝 OBSERVAÇÕES IMPORTANTES

### 1. **Multiusuário vs. Isolado**
- O AS302.PRG foi projetado para ambiente **multiusuário**
- Traz relatórios consolidados de TODOS os usuários
- O PostgreSQL agora replica esse comportamento para pensionistas

### 2. **Outros relatórios**
- Esta correção afeta **apenas** o relatório de pensionistas
- Outros relatórios podem continuar filtrando por usuário (se necessário)
- Verificar se há necessidade de ajuste similar em outros endpoints

### 3. **Filtro de baixa**
- AS302.PRG usa: `TRIM(parcelas.baixa) = ''`
- PostgreSQL aceita: `null`, `''` ou `' '`
- Mais permissivo, mas funcionalmente equivalente

### 4. **TRIM() nas matrículas**
- AS302.PRG usa TRIM no JOIN: `TRIM(parcelas.matricula) = TRIM(socios.matricula)`
- Prisma **não suporta** TRIM direto no JOIN
- **Importante**: Garantir que matrículas não tenham espaços extras na base

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [x] Removido filtro `userId` do WHERE principal
- [x] Removido filtro `userId` do vendaFilter
- [x] Mantido filtro `tipoSocio = 'pensionistas'` (codTipo 3 e 4)
- [x] Mantido filtro `apenasEmAberto = 'true'`
- [x] Código compila sem erros
- [ ] Testar com período 2026-02 (fevereiro)
- [ ] Testar com período 2026-03 (março)
- [ ] Comparar totais com MySQL/LEGADO
- [ ] Validar que valores batem (diferença < R$ 1,00)

---

## 🔗 ARQUIVOS RELACIONADOS

- ✅ **Corrigido**: `/app/src/app/api/relatorios/debitos-socios/route.ts`
- 📄 **Referência**: `/app/As302.Prg` (linhas 115-120)
- 📄 **Comparação MySQL**: `/app/src/app/api/relatorios/pensionistas-mysql/route.ts`
- 📄 **Interface**: `/app/src/app/cliente/relatorios/pensionistas/page.tsx`
- 📄 **Análise anterior**: `/ANALISE_DIFERENCA_PENSIONISTAS.md`

---

**Correção realizada por**: GitHub Copilot  
**Baseado em**: AS302.PRG (sistema legado Harbour/Clipper)  
**Validado por**: [Pendente]

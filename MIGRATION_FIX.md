# Resolver Migração Falhada

## Problema
A migração `20260115233344_add_convenio_table` falhou durante o build do Docker e está impedindo novas migrações.

## Solução Recomendada (Usar Prisma CLI)

### Opção 1: Marcar migração como aplicada
Se a tabela `convenio` já existe no banco de produção:

```bash
npx prisma migrate resolve --applied 20260115233344_add_convenio_table
```

### Opção 2: Marcar migração como rollback
Se a migração não foi aplicada corretamente e precisa ser revertida:

```bash
npx prisma migrate resolve --rolled-back 20260115233344_add_convenio_table
```

Depois, execute:
```bash
npx prisma migrate deploy
```

## Solução Manual (SQL Direto)

Se não tiver acesso ao Prisma CLI no ambiente de produção, execute este SQL no banco:

```sql
-- Para marcar como aplicada
UPDATE "_prisma_migrations" 
SET finished_at = started_at + INTERVAL '1 second',
    applied_steps_count = 1
WHERE migration_name = '20260115233344_add_convenio_table' 
  AND finished_at IS NULL;

-- Ou para marcar como rollback
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260115233344_add_convenio_table' 
  AND finished_at IS NULL;
```

## Verificação

Depois de resolver, verifique o status:
```bash
npx prisma migrate status
```

## Prevenção Futura

Para evitar esse problema em produção:
1. Sempre use `npx prisma migrate deploy` em produção (não `migrate dev`)
2. Teste as migrações em staging antes de produção
3. Faça backup do banco antes de aplicar migrações

-- Script para resolver migração falhada
-- Execute este script no banco de produção para marcar a migração como resolvida

UPDATE "_prisma_migrations" 
SET finished_at = started_at + INTERVAL '1 second',
    applied_steps_count = 1
WHERE migration_name = '20260115233344_add_convenio_table' 
  AND finished_at IS NULL;

-- Marca a migration falhada como rolled back para permitir reaplicação
UPDATE _prisma_migrations 
SET rolled_back_at = NOW() 
WHERE migration_name = '20260117001937_add_password_reset_fields';

-- Ou delete a entrada da migration falhada (use este se o UPDATE não funcionar)
-- DELETE FROM _prisma_migrations WHERE migration_name = '20260117001937_add_password_reset_fields';

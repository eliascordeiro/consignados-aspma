-- AlterTable: adiciona managerPrincipalId para permitir múltiplos emails por cliente MANAGER
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managerPrincipalId" TEXT;

-- AddForeignKey (idempotente: só adiciona se ainda não existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_managerPrincipalId_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_managerPrincipalId_fkey"
      FOREIGN KEY ("managerPrincipalId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_managerPrincipalId_idx" ON "users"("managerPrincipalId");

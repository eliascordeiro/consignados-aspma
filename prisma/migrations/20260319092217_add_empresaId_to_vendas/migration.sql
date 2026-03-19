-- AddColumn: empresaId na tabela vendas (snapshot da empresa no momento da venda)
ALTER TABLE "vendas" ADD COLUMN "empresaId" INTEGER;

-- Backfill: copia o empresaId atual do sócio para todas as vendas existentes
UPDATE "vendas" v
SET "empresaId" = s."empresaId"
FROM "socios" s
WHERE v."socioId" = s."id"
  AND s."empresaId" IS NOT NULL;

-- Índice para performance nos relatórios
CREATE INDEX "vendas_empresaId_idx" ON "vendas"("empresaId");

-- FK para empresas
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

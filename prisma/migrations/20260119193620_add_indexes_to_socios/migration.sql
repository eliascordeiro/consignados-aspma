-- CreateIndex
CREATE INDEX IF NOT EXISTS "socios_nome_idx" ON "socios"("nome");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "socios_matricula_idx" ON "socios"("matricula");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "socios_ativo_idx" ON "socios"("ativo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "socios_empresaId_idx" ON "socios"("empresaId");

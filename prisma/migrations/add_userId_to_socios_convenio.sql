-- Adicionar campo userId na tabela socios
ALTER TABLE socios ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Adicionar campo userId na tabela convenio
ALTER TABLE convenio ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS "socios_userId_idx" ON socios("userId");
CREATE INDEX IF NOT EXISTS "convenio_userId_idx" ON convenio("userId");

-- Adicionar foreign keys
ALTER TABLE socios ADD CONSTRAINT "socios_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE convenio ADD CONSTRAINT "convenio_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Comentários explicativos
COMMENT ON COLUMN socios."userId" IS 'FK para User - usuário que gerencia este sócio (ex: A.S.P.M.A)';
COMMENT ON COLUMN convenio."userId" IS 'FK para User - usuário que gerencia este convênio (ex: A.S.P.M.A)';

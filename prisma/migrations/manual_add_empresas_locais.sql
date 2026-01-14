-- CreateEnum
CREATE TYPE "TipoEmpresa" AS ENUM ('PUBLICO', 'PRIVADO');

-- CreateEnum  
CREATE TYPE "TipoLocal" AS ENUM ('BANCO', 'COMERCIO');

-- AlterTable: Adicionar relacionamentos ao User
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "empresas_count" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locais_count" INTEGER DEFAULT 0;

-- CreateTable: Empresas (Consignatárias)
CREATE TABLE IF NOT EXISTS "empresas" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "tipo" "TipoEmpresa" NOT NULL DEFAULT 'PUBLICO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Sócios (mantém compatibilidade com tabela existente)
CREATE TABLE IF NOT EXISTS "socios_new" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "matricula" TEXT,
    "empresaId" INTEGER NOT NULL,
    "setor" TEXT,
    "salario" DECIMAL(10,2),
    "margemConsig" DECIMAL(10,2),
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "dataAdmissao" TIMESTAMP(3),
    "dataNascimento" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socios_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Locais (Comércios e Bancos)
CREATE TABLE IF NOT EXISTS "locais" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "tipo" "TipoLocal" NOT NULL DEFAULT 'COMERCIO',
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locais_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Autorizações (Empresa <-> Local)
CREATE TABLE IF NOT EXISTS "autorizacoes" (
    "id" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "localId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autorizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "empresas_cnpj_key" ON "empresas"("cnpj");
CREATE UNIQUE INDEX IF NOT EXISTS "socios_new_cpf_key" ON "socios_new"("cpf");
CREATE UNIQUE INDEX IF NOT EXISTS "socios_new_matricula_key" ON "socios_new"("matricula");
CREATE UNIQUE INDEX IF NOT EXISTS "locais_cnpj_key" ON "locais"("cnpj");
CREATE UNIQUE INDEX IF NOT EXISTS "autorizacoes_empresaId_localId_key" ON "autorizacoes"("empresaId", "localId");

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "socios_new" ADD CONSTRAINT "socios_new_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "locais" ADD CONSTRAINT "locais_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "autorizacoes" ADD CONSTRAINT "autorizacoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "autorizacoes" ADD CONSTRAINT "autorizacoes_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrar dados da tabela socios antiga (se existir) para a nova estrutura
-- Nota: O campo 'tipo' em socios será o empresaId
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'socios') THEN
        INSERT INTO socios_new (id, nome, cpf, matricula, empresaId, setor, salario, margemConsig, email, telefone, endereco, dataAdmissao, dataNascimento, ativo, createdAt, updatedAt)
        SELECT 
            gen_random_uuid()::text,
            nome,
            cpf,
            matricula,
            tipo, -- tipo vira empresaId
            setor,
            salario,
            margemConsig,
            email,
            telefone,
            endereco,
            dataAdmissao,
            dataNascimento,
            ativo,
            COALESCE(createdAt, CURRENT_TIMESTAMP),
            COALESCE(updatedAt, CURRENT_TIMESTAMP)
        FROM socios
        ON CONFLICT (cpf) DO NOTHING;
        
        -- Renomear tabelas
        DROP TABLE IF EXISTS socios;
        ALTER TABLE socios_new RENAME TO socios;
    END IF;
END$$;

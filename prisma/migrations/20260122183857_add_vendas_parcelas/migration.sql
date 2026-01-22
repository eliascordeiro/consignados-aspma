/*
  Warnings:

  - The values [PUBLICA,PRIVADA,MISTA] on the enum `TipoEmpresa` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `convenio` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `convenio` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `convenio` column on the `convenio` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `devolucao` column on the `socios` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `codTipo` column on the `socios` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TipoEmpresa_new" AS ENUM ('PUBLICO', 'PRIVADO', 'MISTO');
ALTER TABLE "empresas" ALTER COLUMN "tipo" TYPE "TipoEmpresa_new" USING ("tipo"::text::"TipoEmpresa_new");
ALTER TYPE "TipoEmpresa" RENAME TO "TipoEmpresa_old";
ALTER TYPE "TipoEmpresa_new" RENAME TO "TipoEmpresa";
DROP TYPE "TipoEmpresa_old";
COMMIT;

-- DropIndex
DROP INDEX "funcionarios_matricula_key";

-- AlterTable
ALTER TABLE "convenio" DROP CONSTRAINT "convenio_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "convenio",
ADD COLUMN     "convenio" INTEGER,
ADD CONSTRAINT "convenio_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "socios" ALTER COLUMN "autorizado" DROP NOT NULL,
ALTER COLUMN "autorizado" DROP DEFAULT,
ALTER COLUMN "autorizado" SET DATA TYPE TEXT,
DROP COLUMN "devolucao",
ADD COLUMN     "devolucao" DECIMAL(10,2),
ALTER COLUMN "bloqueio" DROP NOT NULL,
ALTER COLUMN "bloqueio" DROP DEFAULT,
ALTER COLUMN "bloqueio" SET DATA TYPE TEXT,
DROP COLUMN "codTipo",
ADD COLUMN     "codTipo" INTEGER;

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "convenioId" INTEGER NOT NULL,
    "numeroVenda" INTEGER NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operador" TEXT,
    "observacoes" TEXT,
    "quantidadeParcelas" INTEGER NOT NULL,
    "valorParcela" DECIMAL(10,2) NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "motivoCancelamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcelas" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "baixa" CHAR(1),
    "dataBaixa" TIMESTAMP(3),
    "valorPago" DECIMAL(10,2),
    "tipo" CHAR(1),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendas_userId_idx" ON "vendas"("userId");

-- CreateIndex
CREATE INDEX "vendas_socioId_idx" ON "vendas"("socioId");

-- CreateIndex
CREATE INDEX "vendas_convenioId_idx" ON "vendas"("convenioId");

-- CreateIndex
CREATE INDEX "vendas_dataEmissao_idx" ON "vendas"("dataEmissao");

-- CreateIndex
CREATE INDEX "vendas_ativo_idx" ON "vendas"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_socioId_numeroVenda_key" ON "vendas"("socioId", "numeroVenda");

-- CreateIndex
CREATE INDEX "parcelas_vendaId_idx" ON "parcelas"("vendaId");

-- CreateIndex
CREATE INDEX "parcelas_dataVencimento_idx" ON "parcelas"("dataVencimento");

-- CreateIndex
CREATE INDEX "parcelas_baixa_idx" ON "parcelas"("baixa");

-- CreateIndex
CREATE UNIQUE INDEX "parcelas_vendaId_numeroParcela_key" ON "parcelas"("vendaId", "numeroParcela");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "socios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

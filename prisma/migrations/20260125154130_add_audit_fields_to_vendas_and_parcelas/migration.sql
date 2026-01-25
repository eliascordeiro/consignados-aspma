-- AlterTable
ALTER TABLE "parcelas" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- CreateIndex
CREATE INDEX "parcelas_createdById_idx" ON "parcelas"("createdById");

-- CreateIndex
CREATE INDEX "parcelas_updatedById_idx" ON "parcelas"("updatedById");

-- CreateIndex
CREATE INDEX "vendas_createdById_idx" ON "vendas"("createdById");

-- CreateIndex
CREATE INDEX "vendas_updatedById_idx" ON "vendas"("updatedById");

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

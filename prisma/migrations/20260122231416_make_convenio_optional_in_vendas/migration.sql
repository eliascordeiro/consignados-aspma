-- DropForeignKey
ALTER TABLE "vendas" DROP CONSTRAINT "vendas_convenioId_fkey";

-- AlterTable
ALTER TABLE "vendas" ALTER COLUMN "convenioId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

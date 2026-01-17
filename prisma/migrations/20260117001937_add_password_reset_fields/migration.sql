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

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

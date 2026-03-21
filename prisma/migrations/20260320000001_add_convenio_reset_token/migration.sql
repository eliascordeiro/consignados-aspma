-- AlterTable
ALTER TABLE "convenio" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "convenio" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);

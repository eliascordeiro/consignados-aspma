-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'OPERATOR', 'USER');

-- CreateEnum
CREATE TYPE "TipoConsignado" AS ENUM ('EMPRESTIMO', 'CARTAO_CREDITO', 'SEGURO', 'PLANO_SAUDE', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusConsignado" AS ENUM ('ATIVO', 'QUITADO', 'CANCELADO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "TipoFuncionario" AS ENUM ('PUBLICO', 'PRIVADO', 'APOSENTADO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "cpf" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignados" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoConsignado" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "valorParcela" DECIMAL(10,2) NOT NULL,
    "numeroParcelas" INTEGER NOT NULL,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataTermino" TIMESTAMP(3) NOT NULL,
    "status" "StatusConsignado" NOT NULL DEFAULT 'ATIVO',
    "consignataria" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcionarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "matricula" TEXT,
    "tipo" "TipoFuncionario" NOT NULL,
    "orgao" TEXT NOT NULL,
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

    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "funcionarios_cpf_key" ON "funcionarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "funcionarios_matricula_key" ON "funcionarios"("matricula");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignados" ADD CONSTRAINT "consignados_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

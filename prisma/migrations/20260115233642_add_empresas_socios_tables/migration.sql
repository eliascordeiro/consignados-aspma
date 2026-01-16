-- CreateEnum
CREATE TYPE "TipoEmpresa" AS ENUM ('PUBLICA', 'PRIVADA', 'MISTA');

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "tipo" "TipoEmpresa",
    "telefone" TEXT,
    "email" TEXT,
    "contato" TEXT,
    "cep" TEXT,
    "rua" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "rg" TEXT,
    "matricula" TEXT,
    "empresaId" INTEGER,
    "funcao" TEXT,
    "lotacao" TEXT,
    "endereco" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "cidade" TEXT,
    "telefone" TEXT,
    "celular" TEXT,
    "email" TEXT,
    "contato" TEXT,
    "dataCadastro" TIMESTAMP(3),
    "dataAdmissao" TIMESTAMP(3),
    "dataNascimento" TIMESTAMP(3),
    "limite" DECIMAL(10,2),
    "margemConsig" DECIMAL(10,2),
    "gratificacao" DECIMAL(10,2),
    "autorizado" BOOLEAN NOT NULL DEFAULT false,
    "sexo" TEXT,
    "estadoCivil" TEXT,
    "numCompras" INTEGER,
    "tipo" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "banco" TEXT,
    "devolucao" BOOLEAN NOT NULL DEFAULT false,
    "bloqueio" BOOLEAN NOT NULL DEFAULT false,
    "motivoBloqueio" TEXT,
    "codTipo" TEXT,
    "senha" TEXT,
    "dataExclusao" TIMESTAMP(3),
    "motivoExclusao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socios_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

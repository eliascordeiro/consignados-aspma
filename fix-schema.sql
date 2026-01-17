-- Migration simplificada: apenas adiciona campos de password reset
-- Execute este SQL diretamente no Railway se os campos ainda não existem

-- Adiciona os campos de password reset na tabela users
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "resetToken" TEXT,
ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);

-- Migration: Add password reset fields to users table
-- Safe migration: only adds new columns, no destructive changes

-- AlterTable
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "resetToken" TEXT,
ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);

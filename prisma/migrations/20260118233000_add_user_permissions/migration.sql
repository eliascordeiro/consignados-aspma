-- Migration: Add permissions field to users table
-- Safe migration: only adds new column, no destructive changes

-- AlterTable
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

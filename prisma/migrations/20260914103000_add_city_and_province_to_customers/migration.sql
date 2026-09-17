-- Add city and province columns to customers, leads, and projects
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "province" TEXT;

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "province" TEXT;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "province" TEXT;

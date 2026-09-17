-- Add delivery proof fields to shipments table
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "deliveryProofUrl" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "receivedByName" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

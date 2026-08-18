-- CreateTable
CREATE TABLE "item_location_stocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_location_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_location_stocks_itemId_locationId_key" ON "item_location_stocks"("itemId", "locationId");

-- AddForeignKey
ALTER TABLE "item_location_stocks" ADD CONSTRAINT "item_location_stocks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_location_stocks" ADD CONSTRAINT "item_location_stocks_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single location items into item_location_stocks
INSERT INTO "item_location_stocks" ("id", "itemId", "locationId", "qty", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid(),
    "id",
    "locationId",
    COALESCE("currentStock", 0),
    NOW(),
    NOW()
FROM "items"
WHERE "locationId" IS NOT NULL
ON CONFLICT ("itemId", "locationId") DO NOTHING;

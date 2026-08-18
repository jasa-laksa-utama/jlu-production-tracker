-- AlterTable
ALTER TABLE "spb" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateTable
CREATE TABLE "spb_gudang" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "spbNumber" TEXT NOT NULL,
    "projectId" UUID,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PPIC',
    "makerName" TEXT,
    "approvedByPpic" BOOLEAN NOT NULL DEFAULT false,
    "approvedByPpicAt" TIMESTAMP(3),
    "approvedByDireksi" BOOLEAN NOT NULL DEFAULT false,
    "approvedByDireksiAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spb_gudang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spb_gudang_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "spbGudangId" UUID NOT NULL,
    "materialId" UUID,
    "name" TEXT NOT NULL,
    "typeMerk" TEXT,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "source" TEXT NOT NULL DEFAULT 'WAREHOUSE',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvalPpic" TEXT NOT NULL DEFAULT 'PENDING',
    "approvalDireksi" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spb_gudang_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spb_gudang_spbNumber_key" ON "spb_gudang"("spbNumber");

-- AddForeignKey
ALTER TABLE "spb_gudang" ADD CONSTRAINT "spb_gudang_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spb_gudang_items" ADD CONSTRAINT "spb_gudang_items_spbGudangId_fkey" FOREIGN KEY ("spbGudangId") REFERENCES "spb_gudang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spb_gudang_items" ADD CONSTRAINT "spb_gudang_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

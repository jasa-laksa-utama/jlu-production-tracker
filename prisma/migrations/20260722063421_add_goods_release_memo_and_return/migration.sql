-- CreateTable
CREATE TABLE "goods_release_memos" (
    "id" UUID NOT NULL,
    "memoNumber" TEXT NOT NULL,
    "projectId" UUID,
    "requesterName" TEXT NOT NULL,
    "division" TEXT NOT NULL DEFAULT 'PRODUKSI',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "syncInventoryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "externalSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_release_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_release_memo_items" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "itemId" UUID,
    "itemCode" TEXT,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'CONSUMABLE',
    "qtyRequested" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "qtyIssued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyReturned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_release_memo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_return_records" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "returnedBy" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "syncInventoryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_return_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_return_detail_items" (
    "id" UUID NOT NULL,
    "returnRecordId" UUID NOT NULL,
    "memoItemId" UUID NOT NULL,
    "qtyReturned" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'SURPLUS',
    "notes" TEXT,

    CONSTRAINT "goods_return_detail_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goods_release_memos_memoNumber_key" ON "goods_release_memos"("memoNumber");

-- CreateIndex
CREATE UNIQUE INDEX "goods_return_records_returnNumber_key" ON "goods_return_records"("returnNumber");

-- AddForeignKey
ALTER TABLE "goods_release_memos" ADD CONSTRAINT "goods_release_memos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_release_memo_items" ADD CONSTRAINT "goods_release_memo_items_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "goods_release_memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_release_memo_items" ADD CONSTRAINT "goods_release_memo_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_return_records" ADD CONSTRAINT "goods_return_records_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "goods_release_memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_return_detail_items" ADD CONSTRAINT "goods_return_detail_items_returnRecordId_fkey" FOREIGN KEY ("returnRecordId") REFERENCES "goods_return_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_return_detail_items" ADD CONSTRAINT "goods_return_detail_items_memoItemId_fkey" FOREIGN KEY ("memoItemId") REFERENCES "goods_release_memo_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

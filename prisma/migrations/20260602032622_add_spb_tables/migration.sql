-- CreateTable
CREATE TABLE "spb" (
    "id" UUID NOT NULL,
    "spbNumber" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spb_items" (
    "id" UUID NOT NULL,
    "spbId" UUID NOT NULL,
    "materialId" UUID,
    "name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spb_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spb_spbNumber_key" ON "spb"("spbNumber");

-- AddForeignKey
ALTER TABLE "spb" ADD CONSTRAINT "spb_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spb_items" ADD CONSTRAINT "spb_items_spbId_fkey" FOREIGN KEY ("spbId") REFERENCES "spb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spb_items" ADD CONSTRAINT "spb_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

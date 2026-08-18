-- CreateTable
CREATE TABLE "spj" (
    "id" UUID NOT NULL,
    "spjNumber" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "makerName" TEXT,
    "mengetahuiName" TEXT DEFAULT 'Slamet',
    "menyetujuiName" TEXT,
    "approvedByPpic" BOOLEAN NOT NULL DEFAULT false,
    "approvedByPpicAt" TIMESTAMP(3),
    "approvedByPm" BOOLEAN NOT NULL DEFAULT false,
    "approvedByPmAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spj_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spj_items" (
    "id" UUID NOT NULL,
    "spjId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ls',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spj_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spj_spjNumber_key" ON "spj"("spjNumber");

-- AddForeignKey
ALTER TABLE "spj" ADD CONSTRAINT "spj_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spj_items" ADD CONSTRAINT "spj_items_spjId_fkey" FOREIGN KEY ("spjId") REFERENCES "spj"("id") ON DELETE CASCADE ON UPDATE CASCADE;

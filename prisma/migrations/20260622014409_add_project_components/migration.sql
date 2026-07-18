-- AlterTable
ALTER TABLE "_UserRoles" ADD CONSTRAINT "_UserRoles_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserRoles_AB_unique";

-- CreateTable
CREATE TABLE "project_components" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_stages" (
    "id" UUID NOT NULL,
    "componentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "qcStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "qcNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "component_stages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_stages" ADD CONSTRAINT "component_stages_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "project_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

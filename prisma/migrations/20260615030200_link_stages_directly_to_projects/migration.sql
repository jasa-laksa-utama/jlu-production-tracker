-- 1. Add projectId column to production_stages as nullable UUID
ALTER TABLE "production_stages" ADD COLUMN "projectId" UUID;

-- 2. Backfill projectId values from production_components using the old relation
UPDATE "production_stages" s
SET "projectId" = c."projectId"
FROM "production_components" c
WHERE s."componentId" = c.id;

-- 3. Drop old foreign key constraint
ALTER TABLE "production_stages" DROP CONSTRAINT "production_stages_componentId_fkey";

-- 4. Drop componentId column
ALTER TABLE "production_stages" DROP COLUMN "componentId";

-- 5. Drop production_components table
DROP TABLE "production_components";

-- 6. Add new foreign key constraint from production_stages to projects
ALTER TABLE "production_stages" ADD CONSTRAINT "production_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

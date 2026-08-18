-- AlterTable
ALTER TABLE "goods_release_memo_items" ADD COLUMN IF NOT EXISTS "spbItemId" UUID;

-- AddForeignKey
ALTER TABLE "goods_release_memo_items" ADD CONSTRAINT "goods_release_memo_items_spbItemId_fkey" FOREIGN KEY ("spbItemId") REFERENCES "spb_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Script SQL untuk mengupdate semua satuan komponen structure dari 'unit' menjadi 'set'
UPDATE "structure_items"
SET "satuan" = 'set'
WHERE LOWER("satuan") = 'unit'
   OR "satuan" IS NULL
   OR "satuan" = '';

# 02 — Auto-Sync SPB/PO ke Stage Procurement & PO (Dengan Fallback Manual)

**What to build:** An automated synchronization hook triggered when SPB requests or Purchase Orders (PO) are approved/issued. Match SPB items with project `MechanicalItem` and `StructureItem` records by item name/ID, automatically populating `procurementQty` and `poQty` and recalculating progress percentages (`progressPercent`). Retain manual inline stage quantity input as fallback.

**Blocked by:** 01 — Database Schema & Automated KPI Timestamps Engine

**Status:** completed

- [x] Create SPB/PO auto-sync function in `src/app/actions/spb.ts` and `conveyor-progress.ts`.
- [x] Match material items against Masterplan `MechanicalItem` and `StructureItem` by item name/materialId.
- [x] Update `procurementQty` and `poQty` based on approved SPB/PO quantities.
- [x] Recalculate component progress percentages using `calcMechanicalItemProgress` and `calcStructureItemProgress`.
- [x] Ensure manual inline edit of stage quantities remains fully functional as fallback.

# 01 — Database Schema & Automated KPI Timestamps Engine

**What to build:** Add milestone timestamp fields (`dealAt`, `boqApprovedAt`, `spbCompletedAt`, `poCompletedAt`, `productionCompletedAt`, `qcCompletedAt`) to the `Project` model and create an automated KPI duration calculation helper. When key system events occur (BoQ approved, SPB/PO issued, Production 100%, QC signed off), automatically record milestone timestamps in `Project` and audit logs in `ProjectHistory`.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Add `dealAt`, `boqApprovedAt`, `spbCompletedAt`, `poCompletedAt`, `productionCompletedAt`, `qcCompletedAt` to `Project` model in `prisma/schema.prisma`.
- [x] Run `npx prisma migrate dev` to apply migration cleanly.
- [x] Create utility helper `calcProjectDivisionKPIs` to calculate duration in days/hours for Engineering, PPIC/Procurement, Production, and QC.
- [x] Add auto-timestamp update triggers on BoQ approval (`src/app/actions/boq.ts`), SPB/PO creation/approval (`src/app/actions/spb.ts`), and QC sign-off.

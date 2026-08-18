# 03 — Multi-Badge Real-Time Status & KPI Grid pada Dashboard Utama

**What to build:** A Multi-Badge Real-Time Status grid component on the main Project Tracker dashboard (`src/components/trackers/production-table.tsx`), displaying live status badges and auto-calculated KPI duration indicators for Engineering, PPIC/Procurement, Produksi, and QC/Shipping side by side.

**Blocked by:** 01 — Database Schema & Automated KPI Timestamps Engine, 02 — Auto-Sync SPB/PO ke Stage Procurement & PO (Dengan Fallback Manual)

**Status:** completed

- [x] Create `MultiBadgeStatus` UI component in `src/components/trackers/production-table.tsx`.
- [x] Display live status badges for Engineering (BoQ status), PPIC (Procurement & PO %), Produksi (Physical S-Curve %), and QC.
- [x] Display auto-calculated KPI duration metrics (*e.g., "Eng: 3 Days", "PPIC: 2 Days"*).
- [x] Ensure smooth responsive grid layout for both dark and light modes.

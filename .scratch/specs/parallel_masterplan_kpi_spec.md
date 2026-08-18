# Specification (PRD): Redesain Handover Sekuensial ke Parallel Masterplan & Auto-Trigger KPI

## Problem Statement

Sistem sebelumnya menggunakan alur handover sekuensial murni (*Sales ➔ Engineering ➔ PPIC ➔ Production ➔ QC ➔ Shipping*). Alur ini mengunci akses data proyek hingga suatu divisi menyelesaikan proses handover resmi. 

Dalam praktiknya, alur sekuensial ini menciptakan dua masalah utama:
1. **Penyumbatan Data (*Bottleneck*)**: Data Masterplan Produksi (Conveyor Units, Gambar Teknik, BoQ, dan SPB/PO Pengadaan) seharusnya di-setup dan dilacak sejak status proyek menjadi *Deal*. Penguncian sekuensial menyebabkan progress Engineering dan PPIC/Procurement tidak dapat tercatat pada Masterplan secara *real-time*.
2. **Keterlambatan Pencatatan Waktu (KPI)**: Tombol handover manual berisiko lupa atau terlambat ditekan oleh pengguna, sehingga perhitungan durasi KPI divisi menjadi tidak akurat ("takut lama").

---

## Solution

Mengubah alur proyek menjadi **Arsitektur Dual-Track (*Parallel Shared Masterplan + Automated KPI Triggers*)**:

1. **Akses Data Paralel & Terbuka Sejak Project Deal**:
   * Data proyek dan Masterplan terbuka bagi seluruh divisi sejak hari pertama proyek berstatus *Deal*.
   * PPIC melakukan setup Masterplan & daftar komponen (Struktur & Mekanikal) secara manual dari Halaman Production.
2. **Auto-Sync antar Divisi (Tanpa Input Ganda)**:
   * Penerbitan SPB & PO di modul PPIC/Purchasing secara otomatis mencocokkan item dan mengupdate kuantitas `procurementQty` & `poQty` pada komponen Masterplan.
   * Tetap menyediakan opsi pemetaan manual saat SPB/PO dibuat serta edit manual pada tabel Produksi sebagai *fallback*.
3. **Penghapusan Handover Manual & Auto-Trigger KPI Waktu**:
   * Tombol handover manual dan penguncian posisi divisi dihapus seluruhnya.
   * Timestamp durasi KPI divisi dihitung secara otomatis berdasarkan *event/trigger* aktivitas sistem (*Deal ➔ BoQ Approved ➔ SPB/PO Complete ➔ Production 100% ➔ QC Sign-off*).
4. **Dashboard Utama Multi-Badge Real-Time Status**:
   * Tampilan utama proyek menyajikan badge status real-time dari setiap divisi (*Engineering, PPIC/Procurement, Production, QC*) bersisian dengan durasi KPI masing-masing.

---

## User Stories

1. As a PPIC Manager, I want to initialize and set up the Masterplan (Conveyor Units and component lists) directly from the Production page as soon as a project is Deal, so that the production roadmap is immediately ready.
2. As an Engineering Lead, I want my approved BoQ and Part List items to be accessible alongside the Masterplan components, so that engineering specifications are seamlessly connected to production.
3. As a Purchasing/PPIC Officer, I want approved SPB requests and Purchase Orders (PO) to automatically sync `procurementQty` and `poQty` into the corresponding Masterplan mechanical and structure components, so that I don't have to manually update production tables.
4. As a Production Supervisor, I want to focus on updating physical stage progress (Cutting, Setting, Welding, Finishing, Painting, Packaging) while seeing procurement stages updated automatically, so that I don't waste time re-entering procurement data.
5. As a Production Supervisor, I want the ability to manually override or edit `procurementQty` and `poQty` directly on the production table as a fallback, so that I can correct any discrepancies or system sync delays.
6. As a Department Head, I want division KPI durations (Engineering, PPIC, Production, QC) to be tracked automatically from system activity timestamps without requiring manual handover button clicks, so that KPI data is always accurate and free from human delay.
7. As a Project Manager, I want to view a Multi-Badge Real-Time Status on the main project dashboard showing progress percentages and KPI durations for all divisions simultaneously, so that I can monitor overall project health at a glance.
8. As a System Auditor, I want every auto-sync and manual progress update to create an audit log in `ProjectHistory` and `ProductionLog`, so that all changes are fully traceable.

---

## Implementation Decisions

### Modules to Modify / Build

1. **Project Management & Status Engine**:
   * Remove strict sequential division access checks. Allow read/write to Masterplan & Project components based on user role permissions rather than division locks.
   * Implement automated timestamp recorder for division KPI metrics in `Project` and `ProjectHistory` models.

2. **Masterplan & Conveyor Progress Module (`src/app/actions/conveyor-progress.ts`)**:
   * Maintain manual PPIC setup flow for Conveyor Units and components (`StructureItem` & `MechanicalItem`).
   * Ensure default `satuan` for new items is `"set"` for both Structure and Mechanical components.

3. **SPB & Purchasing Auto-Sync Engine (`src/app/actions/spb.ts`)**:
   * Add auto-sync hook on SPB/PO status transition (`APPROVED` / `ISSUED`).
   * Match SPB/PO material items against project `MechanicalItem` and `StructureItem` by name/materialId.
   * Update `procurementQty` and `poQty` and trigger progress percent recalculation via `calcMechanicalItemProgress` and `calcStructureItemProgress`.

4. **Production & Mechanical Progress Tables (`src/components/trackers/`)**:
   * Remove manual "Handover to Next Division" blocking banners and buttons.
   * Retain inline editable inputs for stage quantities and details with green accent highlights on stage completion.
   * Provide explicit manual override capability for `procurementQty` and `poQty`.

5. **Main Dashboard (`src/components/trackers/production-table.tsx` & `projects.ts`)**:
   * Replace single-division status badge with **Multi-Badge Real-Time Status** grid (Engineering, PPIC/Procurement, Production, QC).
   * Display auto-calculated KPI duration badges (*e.g., "Eng: 3 Days", "PPIC: 2 Days"*).

### Data Schema Enhancements (Prisma Schema)

* **`Project` Model**:
  * Track milestone timestamps: `dealAt`, `boqApprovedAt`, `spbCompletedAt`, `poCompletedAt`, `productionCompletedAt`, `qcCompletedAt`.
  * Multi-badge status fields: `engStatus`, `ppicStatus`, `prodStatus`, `qcStatus`.

* **`ProjectHistory` Model**:
  * Record automated activity events: `EVENT_BOQ_APPROVED`, `EVENT_PO_COMPLETED`, `EVENT_PRODUCTION_COMPLETED`, `EVENT_QC_SIGNED`.

---

## Testing Decisions

### Seams & Boundaries to Test

1. **Server Action & Database Seams**:
   * Test `addMechanicalItemsToUnit` and `addStructureItemsToUnit` for correct default `satuan = "set"`.
   * Test SPB/PO auto-sync hook: verify `procurementQty` and `poQty` update automatically upon SPB approval and recalculate progress percentages.
   * Test automated KPI duration calculator: verify timestamp diffs (`boqApprovedAt - dealAt`, etc.) calculate exact days/hours accurately.

2. **External Behavior & UI Testing**:
   * Verify spreadsheet-style row reordering via HTML5 Drag and Drop across table rows.
   * Verify green accent highlight triggers on 100% stage completion.
   * Verify Multi-Badge status display on the main Project Tracker dashboard.

---

## Out of Scope

* Third-party external inventory ERP sync (handled in separate inventory system).
* Financial accounting ledger posting for PO invoices (handled in purchasing/finance module).

---

## Further Notes

* All changes maintain backward compatibility with existing project records.
* Fallback manual editing ensures zero risk if automated item matching encounters edge-case naming differences in SPB items.

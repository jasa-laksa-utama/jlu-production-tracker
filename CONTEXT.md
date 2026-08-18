# CONTEXT.md - Konsep Alur & Diskusi Redesain System Handover vs Masterplan

## Context & Vision Proyek

### 1. Alur Awal (Sequential Handover)
* Data bergerak secara sekuensial: **Sales (Deal)** ➔ **Engineering** ➔ **PPIC** ➔ **Production** ➔ **QC** ➔ **Shipping/Inventory**.
* Menggunakan mekanisme **Handover** resmi untuk setiap perpindahan divisi.
* **Keunggulan**: Alur rapi dan linier, memudahkan tracking durasi waktu (KPI) dari masing-masing divisi (kapan masuk, kapan selesai/di-handover, serta total durasi proyek berada di divisi tersebut).

---

## Masalah Utama (The Challenge)

* **Kontradiksi dengan Cara Kerja Masterplan**:
  * Berdasarkan konsep Masterplan Produksi, data produksi (Masterplan, Conveyor Units, Komponen) seharusnya sudah di-setup sejak awal saat **Project Deal**.
  * Masterplan mencakup tahapan yang dikerjakan oleh divisi lain sebelum produksi fisik dimulai:
    1. **Engineering**: Gambar teknik (Drawings), BoQ, dan Mechanical Part List.
    2. **PPIC & Purchasing & Warehouse**: Proses Pengadaan/Procurement, Surat Permintaan Barang (SPB), dan Purchase Order (PO).
* **Masalah Efisiensi**:
  * Jika data produksi baru dimasukkan/di-handover ke tim produksi melalui PPIC secara sekuensial di akhir, maka progress **Engineering** dan **Procurement/PPIC** pada Masterplan sulit/terlambat tercatat secara akurat.
  * Meminta tim produksi menginputkan data pengadaan/engineering secara manual adalah *redundant* dan membebaskan beban kerja yang salah pada tim produksi.

---

## Usulan Redesain Alur (Parallel Data Access & Auto-Sync)

### Konsep Solusi:
1. **Inisialisasi Masterplan Sejak Project Deal**:
   * Saat Project berstatus **Deal**, Masterplan & Tracker Produksi langsung di-generate / di-setup sejak awal.
2. **Auto-Sync antar Divisi (Tanpa Input Ganda oleh Tim Produksi)**:
   * **Divisi Engineering**: Mengisi BoQ / Part List ➔ Otomatis membuat/memperbarui daftar komponen Struktur & Mekanikal pada Tracker Produksi.
   * **Divisi PPIC & Purchasing**: Memproses SPB & PO ➔ Otomatis mengupdate stage `Procurement` & `PO` pada komponen Mekanikal/Struktur di Tracker Produksi.
   * **Divisi Produksi**: Fokus mengupdate progress fisik lapangan (Cutting, Setting, Welding, Finishing, Painting, Packaging).
   * **Fallback**: Tetap menyediakan input/override manual untuk tim Produksi jika ada kondisi khusus di lapangan.
3. **Tetap Mempertahankan KPI Durasi Divisi (Milestone Handovers)**:
   * Tracking KPI waktu tidak lagi memblokir akses data.
   * Setiap divisi memiliki **Milestone Status & Timestamp** (misal: *Engineering Entry/Exit Date*, *PPIC Entry/Exit Date*, *Production Entry/Exit Date*) di tabel `ProjectHistory`.
   * Durasi pengerjaan divisi tetap tercatat dengan akurat dari timestamp `entryDate` hingga `exitDate` tanpa harus mengunci data dari divisi lainnya.

---

## Keputusan Arsitektur Disepakati (Agreed Decisions)

### Decision 1: Inisialisasi & Setup Masterplan
* **Aturan**: Inisialisasi dan konfigurasi Masterplan tetap dilakukan secara **manual oleh PPIC melalui Halaman Production**.
* **Rasional**: PPIC adalah pihak yang memiliki wewenang dan pemahaman penuh terkait pembobotan durasi, penjadwalan S-Curve, dan konfigurasi fase masterplan.
* **Dampak**: Begitu Project Deal, PPIC dapat langsung meng-inisialisasi Masterplan dari Halaman Production tanpa harus menunggu proses fisik/handover akhir dari divisi lain.

### Decision 2: Pengisian Unit Conveyor & Komponen (Struktur & Mekanikal)
* **Aturan**: Unit Conveyor beserta daftar komponen Struktur dan Mekanikal diisi langsung oleh **PPIC saat melakukan Setup Masterplan** di Halaman Production.
* **Dampak**: Masterplan dan daftar komponen langsung siap sejak awal. Divisi lain (Engineering & Purchasing/PPIC) tinggal melakukan auto-sync / pembaruan stage sesuai scope masing-masing.

### Decision 3: Auto-Sync SPB & PO ke Stage Procurement & PO (Dengan Fallback Manual)
* **Aturan Utama**: Otomatis ter-update berdasarkan matching item saat SPB/PO diterbitkan di modul PPIC/Purchasing. Kuantitas `procurementQty` & `poQty` terisi otomatis dan memperbarui persentase progress Masterplan.
* **Fallback (Cadangan)**: 
  1. Opsi pemilihan/pemetaan manual komponen saat pembuatan SPB/PO.
  2. Input/edit manual angka progress `procurementQty` dan `poQty` langsung di tabel progress Produksi jika terjadi kesalahan/penyesuaian sistem.

### Decision 4: Penghapusan Sistem Handover Manual & Auto-Trigger KPI Waktu
* **Aturan**: Menghapus tombol handover manual antar divisi dan sistem penguncian posisi divisi ("sampe divisi mana"). Data proyek terbuka penuh sejak status Project Deal.
* **Rasional**: Mencegah *bottleneck* akibat tombol handover terlambat/lupa ditekan ("takut lama").
* **Mekanisme Automatic KPI Timestamps**:
  1. **Durasi Engineering**: Dihitung dari `Project Deal` ➔ `BoQ Disetujui`.
  2. **Durasi PPIC / Procurement**: Dihitung dari `BoQ Disetujui` ➔ `SPB & PO Selesai`.
  3. **Durasi Produksi**: Dihitung dari `SPB & PO Selesai` / `Masterplan Setup` ➔ `Progress Produksi 100%`.
  4. **Durasi QC**: Dihitung dari `Progress Produksi 100%` ➔ `QC Signed Off`.

### Decision 5: Tampilan Multi-Badge Real-Time Status & Dashboard KPI Utama
* **Aturan**: Dashboard Utama menampilkan kartu/tabel proyek dengan **Multi-Badge Real-Time Status** dari setiap divisi secara bersisian beserta durasi KPI otomatisnya:
  1. **Engineering**: Status BoQ & durasi pengerjaan *(misal: COMPLETED • 3 Hari)*.
  2. **PPIC & Procurement**: Status % SPB/PO & durasi *(misal: IN_PROGRESS (70%) • 2 Hari)*.
  3. **Produksi**: Status progress fisik S-Curve/komponen.
  4. **QC & Shipping**: Status QC Sign-off & dokumen pengiriman.






# Panduan Integrasi Database: Ingesti Data Serah Terima Logistik (Revisi: Alur Per Komponen)

Dokumen ini ditujukan untuk **Tim Developer Sistem Inventory & Shipping** sebagai panduan untuk mengambil (fetch/pull) data hasil Quality Control (QC) per komponen dan log serah terima (handover) parsial dari database PostgreSQL sistem Production Tracker.

---

## 1. Konsep Integrasi Baru (Per Komponen)

Sistem Production Tracker kini melacak proses fabrikasi dan inspeksi Quality Control (QC) secara granular **per komponen**, bukan lagi global per proyek. 
- Setiap proyek memiliki satu atau lebih **Komponen** (`project_components`).
- Setiap komponen melewati beberapa **Tahapan Produksi** (`component_stages`), seperti *Fabrikasi*, *Machining*, *Mechanical*, atau *Finishing*.
- Tim QC menginspeksi dan menyetujui progress secara terpisah untuk setiap tahapan komponen tersebut (`qcStatus` = `"APPROVED"`).
- Ketika **seluruh tahapan aktif** suatu komponen telah disetujui oleh QC, komponen tersebut dinyatakan lolos QC dan siap diserahterimakan secara parsial ke divisi **Logistik** untuk proses pengiriman/marking.
- Logistik dapat mengambil data serah terima yang berisi daftar komponen spesifik melalui tabel relasi `project_handovers` dan `project_components`.

---

## 2. Struktur Tabel Database Terkait

### A. Tabel: `projects` (Data Proyek)
Menyimpan informasi utama proyek dan status logistik global.
* **`id`** (`UUID`): ID unik proyek (Primary Key).
* **`projectNumber`** (`VARCHAR`): Nomor SPK / Project Number (contoh: `"PROJECT-06-2026-001"`).
* **`projectName`** (`VARCHAR`): Nama alat/mesin proyek (contoh: `"Conveyor Belt 100M"`).
* **`currentDivision`** (`VARCHAR`): Divisi aktif saat ini. Bernilai **`"LOGISTIC"`** jika ada komponen yang siap dikirim/dikelola logistik.
* **`currentStatus`** (`VARCHAR`): Status divisi. Bernilai **`"READY"`** saat serah terima terjadi.
* **`logStatus`** (`VARCHAR`): Status khusus Logistik (contoh: `"READY"`, `"ON_PROGRESS"`, `"DONE"`).
* **`customerId`** (`UUID`): Relasi ke pelanggan (`customers.id`).
* **`expectedDate`** (`TIMESTAMP`): Deadline pengiriman ke pelanggan.

### B. Tabel: `project_components` (Data Komponen Proyek)
Menyimpan informasi komponen yang diproduksi dan status handovers-nya.
* **`id`** (`UUID`): ID unik komponen (Primary Key).
* **`projectId`** (`UUID`): Relasi ke proyek terkait (`projects.id`).
* **`name`** (`VARCHAR`): Nama komponen (contoh: `"Shaft Roller"`, `"Main Frame"`).
* **`handoverId`** (`UUID`, Nullable): ID serah terima logistik (`project_handovers.id`). Jika kolom ini **tidak null**, artinya komponen sudah diserahkan ke divisi logistik.

### C. Tabel: `component_stages` (Status Progress & QC per Tahap)
Menyimpan status pengerjaan fisik dan hasil inspeksi QC dari setiap tahapan komponen.
* **`id`** (`UUID`): Primary Key.
* **`componentId`** (`UUID`): Relasi ke komponen (`project_components.id`).
* **`name`** (`VARCHAR`): Nama tahap (contoh: `"Fabrikasi"`, `"Machining"`).
* **`progress`** (`INT`): Progress pengerjaan (0 - 100%).
* **`status`** (`VARCHAR`): Status fisik (`"READY"`, `"IN_PROGRESS"`, `"DONE"`, `"REVISION"`).
* **`qcStatus`** (`VARCHAR`): Status persetujuan QC (**`"PENDING"`**, **`"APPROVED"`**, **`"REJECTED"`**).

### D. Tabel: `project_handovers` (Log Serah Terima Logistik)
Mencatat kloter transaksi pemindahan barang dari Produksi/QC ke Logistik.
* **`id`** (`UUID`): ID transaksi serah terima (Primary Key).
* **`projectId`** (`UUID`): Relasi ke proyek terkait (`projects.id`).
* **`stages`** (`TEXT`): Deskripsi string dari komponen yang diserahkan.
* **`notes`** (`TEXT`): Catatan/memo serah terima lapangan dari tim inspektur QC.
* **`handoverBy`** (`VARCHAR`): Nama inspektur QC yang melakukan serah terima.
* **`createdAt`** (`TIMESTAMP`): Waktu dilakukannya transaksi serah terima.

### E. Tabel: `customers` (Detail Pelanggan)
Menyimpan data pengiriman dan kontak klien.
* **`id`** (`UUID`): ID unik pelanggan.
* **`name`** (`VARCHAR`): Nama PIC pelanggan.
* **`company`** (`VARCHAR`): Nama perusahaan.
* **`address`** (`TEXT`): Alamat pengiriman barang jadi.

---

## 3. Query Kondisi & Contoh SQL untuk Developer Inventory

Berikut adalah query SQL yang dapat digunakan oleh tim Inventory untuk memproses data komponen dari hasil QC:

### A. Memantau Komponen yang Sudah Lolos QC (Siap Handover ke Logistik)
Gunakan query ini untuk mendeteksi komponen mana saja yang **seluruh tahapan aktifnya sudah disetujui (APPROVED) oleh QC**, namun belum diserahterimakan secara resmi (belum diklik handover oleh QC, sehingga `handoverId IS NULL`). Ini berguna bagi tim inventory/shipping untuk memantau antrean barang yang akan segera dikirim.

```sql
SELECT 
    pc.id AS component_id,
    pc.name AS component_name,
    p.id AS project_id,
    p.projectNumber AS project_number,
    p.projectName AS project_name
FROM project_components pc
JOIN projects p ON pc.projectId = p.id
WHERE pc.handoverId IS NULL
  -- Pastikan semua tahapan yang terdaftar untuk komponen ini sudah di-APPROVED oleh QC
  AND NOT EXISTS (
      SELECT 1 
      FROM component_stages cs 
      WHERE cs.componentId = pc.id 
        AND cs.qcStatus != 'APPROVED'
  )
  -- Memastikan komponen memiliki minimal satu tahapan aktif (menghindari false positive)
  AND EXISTS (
      SELECT 1 
      FROM component_stages cs 
      WHERE cs.componentId = pc.id
  );
```

### B. Mengambil Komponen yang Telah Resmi Diserahterimakan (Handed Over)
Gunakan query ini untuk mengambil daftar serah terima (handover) beserta rincian komponen apa saja yang masuk dalam kloter serah terima tersebut. Data inilah yang akan diproses oleh tim Inventory untuk pengemasan (packing), penandaan (marking), dan pengiriman.

```sql
SELECT 
    ph.id AS handover_id,
    ph.createdAt AS handover_date,
    ph.handoverBy AS inspector_name,
    ph.notes AS handover_notes,
    p.projectNumber AS project_number,
    p.projectName AS project_name,
    pc.id AS component_id,
    pc.name AS component_name,
    c.company AS customer_company,
    c.name AS customer_pic,
    c.address AS shipping_address
FROM project_handovers ph
JOIN projects p ON ph.projectId = p.id
JOIN project_components pc ON pc.handoverId = ph.id
JOIN customers c ON p.customerId = c.id
ORDER BY ph.createdAt DESC;
```

### C. Sinkronisasi Data Serah Terima Baru Secara Berkala (Incremental Pulling)
Untuk melakukan penarikan data baru secara berkala (scheduler), simpan `last_fetch_timestamp` dari jalannya proses sebelumnya, kemudian jalankan query filter berbasis tanggal pembuatan handover:

```sql
SELECT 
    ph.id AS handover_id,
    ph.createdAt AS handover_date,
    p.projectNumber AS project_number,
    p.projectName AS project_name,
    pc.id AS component_id,
    pc.name AS component_name,
    ph.notes AS handover_notes
FROM project_handovers ph
JOIN projects p ON ph.projectId = p.id
JOIN project_components pc ON pc.handoverId = ph.id
WHERE ph.createdAt > :last_fetch_timestamp
ORDER BY ph.createdAt ASC;
```

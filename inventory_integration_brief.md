# Dokumen Integrasi: Alur Handover Proyek ke Sistem Inventory (Warehouse & Purchasing)

Dokumen ini ditulis sebagai panduan teknis bagi pengembang **Sistem Inventory** untuk mendeteksi, membaca, dan memperbarui status proyek beserta Surat Permintaan Barang (SPB) yang dikirim oleh **Sistem Tracker Produksi (PPIC)**.

---

## 1. Trigger Kondisi (Pemicu Handover)

Sistem Tracker mengirimkan proyek ke Inventory dengan memperbarui kolom-kolom berikut di tabel `projects`:
- `currentDivision` = `"INVENTORY"`
- `status` (Global Status) = `"WAITING_INVENTORY"`
- `currentStatus` = `"WAITING_INVENTORY"`

---

## 2. Cara Mengambil Data Proyek & SPB (Fetch Data)

Untuk memproses proyek, Sistem Inventory perlu membaca proyek yang berstatus `"WAITING_INVENTORY"`, mengambil data Surat Permintaan Barang (SPB), dan data barang di dalamnya (`spb_items`).

### Kriteria Status Proyek Awal saat Handover:
1. **`purchasingStatus`**:
   - Selalu bernilai `"WAITING_PO"`. Seluruh proyek/SPB dikirim ke **Purchasing** terlebih dahulu untuk verifikasi dan alur persetujuan biaya (Accounting).
2. **`warehouseStatus`**:
   - Selalu bernilai `"PENDING"`. Tim Purchasing akan memverifikasi SPB tersebut terlebih dahulu, baru kemudian mengaktifkan alur gudang dengan membiarkan `warehouseStatus` tetap `"PENDING"` (jika ada barang stok gudang) atau `"NOT_REQUIRED"` (jika tidak ada barang gudang).

### Contoh Query Mengambil Data (Prisma Client):
```typescript
const inventoryProjects = await prisma.project.findMany({
  where: {
    status: "WAITING_INVENTORY",
    currentDivision: "INVENTORY",
  },
  include: {
    customer: true,
    spb: {
      include: {
        items: {
          include: {
            material: true, // Untuk membaca code/name item gudang
          }
        }
      }
    }
  }
});
```

---

## 3. Logika Alur Kerja & Pembaruan Status (Writeback)

Sistem Inventory wajib memperbarui status proyek di tabel `projects` setiap kali terjadi kemajuan pemrosesan barang agar sistem Tracker dapat menampilkan progres secara *real-time*.

### A. Alur Kerja Warehouse (Gudang)
1. Tim Warehouse memproses item SPB yang memiliki `source === "WAREHOUSE"`.
2. Setelah barang selesai disiapkan dan diserahkan ke tim produksi:
   - **Aksi Database**: Ubah kolom `warehouseStatus` pada proyek tersebut menjadi **`"PREPARED"`**.

### B. Alur Kerja Purchasing (Pembelian)
1. Tim Purchasing memproses semua SPB yang masuk (`purchasingStatus === "WAITING_PO"`).
2. **Aksi Verifikasi Awal (Jika Ada Barang Gudang)**: 
   - Setelah Purchasing memverifikasi SPB dan mengizinkan pengambilan stok, status **`warehouseStatus`** tetap **`"PENDING"`** agar tim Warehouse dapat mulai memprosesnya di dashboard mereka.
3. **Proses Barang Trading (Pembelian)**:
   - Jika ada barang trading, setelah Purchase Order (PO) dibuat ke vendor, ubah **`purchasingStatus`** menjadi **`"PO_CREATED"`**.
   - Setelah barang pesanan dari vendor tiba di workshop/gudang dan siap digunakan produksi, ubah **`purchasingStatus`** menjadi **`"RECEIVED"`**.
4. **Proses Tanpa Barang Trading (Hanya Pakai Stok)**:
   - Jika seluruh barang menggunakan stok (`hasTrading === false`), setelah verifikasi selesai dan status gudang dilepas ke `"PENDING"`, Purchasing mengubah status dirinya sendiri (**`purchasingStatus`**) menjadi **`"RECEIVED"`** atau **`"NOT_REQUIRED"`** untuk menyelesaikan tugasnya.

---

## 4. Penyelesaian Tahap Inventory (Handover ke Produksi)

Ketika **kedua sub-divisi** telah menyelesaikan tugasnya masing-masing, proyek dinyatakan selesai di tahap Inventory dan siap masuk ke tahap Produksi.

### Kondisi Selesai:
- (`warehouseStatus` bernilai `"PREPARED"` ATAU `"NOT_REQUIRED"`)
- **DAN**
- (`purchasingStatus` bernilai `"RECEIVED"` ATAU `"NOT_REQUIRED"`)

### Aksi Database Ketika Selesai:
Untuk mengembalikan kendali proyek kembali ke alur produksi (Sistem Tracker), Sistem Inventory harus memperbarui kolom proyek sebagai berikut:
- **`currentDivision`** = `"PRODUCTION"`
- **`status`** = `"ON_PROGRESS"`
- **`currentStatus`** = `"PENDING"` (Menandakan antrean di divisi Produksi)

Selain itu, buatlah entri baru di tabel `project_histories` untuk mencatat log perpindahan divisi ini secara resmi:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update Project
  await tx.project.update({
    where: { id: projectId },
    data: {
      currentDivision: "PRODUCTION",
      status: "ON_PROGRESS",
      currentStatus: "PENDING",
      prodStatus: "PENDING",
      prodEntryDate: new Date(),
    },
  });

  // 2. Tutup Log History Sebelumnya (Inventory)
  const lastHistory = await tx.projectHistory.findFirst({
    where: { projectId, exitDate: null },
    orderBy: { entryDate: "desc" },
  });
  if (lastHistory) {
    await tx.projectHistory.update({
      where: { id: lastHistory.id },
      data: { exitDate: new Date() },
    });
  }

  // 3. Buat Log History Baru (Production)
  await tx.projectHistory.create({
    data: {
      projectId,
      division: "PRODUCTION",
      status: "PENDING",
      entryDate: new Date(),
      notes: "Material preparation completed by Inventory. Handed over to Production.",
    },
  });
});
```

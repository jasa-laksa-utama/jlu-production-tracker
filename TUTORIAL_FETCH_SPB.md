# Tutorial Integrasi Data: Fetch SPB Disetujui (Approved) untuk Sistem Inventory Terpisah

Dokumen ini menjelaskan cara mengambil data pengajuan Surat Permintaan Barang (SPB) yang telah mendapatkan persetujuan (approval) penuh dari **PPIC** dan **Project Manager (PM)**, untuk kemudian dikonsumsi oleh Sistem Inventory terpisah.

---

## 1. Definisi Data (Skema Database)

Sistem internal menggunakan database relasional yang dipetakan menggunakan Prisma ORM. Berikut adalah struktur tabel `spb` dan `spb_items` yang relevan:

### Tabel `spb` (Surat Permintaan Barang)
* `id` (UUID): Identifikasi unik dokumen SPB.
* `spbNumber` (String): Nomor registrasi dokumen SPB resmi (contoh: `SPB/PROJECT/07/2026/002-01`).
* `projectId` (UUID): Proyek terkait.
* `status` (String): Status dokumen (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`).
* `approvedByPpic` (Boolean): Flag persetujuan dari divisi PPIC.
* `approvedByPm` (Boolean): Flag persetujuan dari Project Manager.
* `createdAt` (DateTime): Waktu pembuatan SPB.

### Tabel `spb_items` (Item Barang dalam SPB)
* `id` (UUID): Identifikasi unik item barang.
* `spbId` (UUID): Relasi ke tabel `spb`.
* `materialId` (UUID, Optional): ID barang di Master Data (jika terhubung).
* `name` (String): Nama material/barang.
* `typeMerk` (String, Optional): Spesifikasi tipe atau merk barang.
* `qty` (Float): Kuantitas barang yang diminta.
* `unit` (String): Satuan barang (contoh: `pcs`, `kg`, `meter`).
* `source` (String): Sumber pengadaan barang (`WAREHOUSE` jika dari gudang / `TRADING` jika dibeli).
* `status` (String): Status progres pemenuhan barang (`PENDING`, `FULFILLED`, `RECEIVED`, dll.).
* `qtyIssued` (Float): Jumlah barang yang sudah dikeluarkan/di-release oleh Inventory.

---

## 2. Kriteria SPB Lolos Verifikasi (Siap Masuk Inventory)

Dokumen SPB dianggap sah untuk diproses oleh divisi/sistem Inventory jika memenuhi kondisi berikut:

1. Nilai kolom `status` pada tabel `spb` bernilai **`APPROVED`**.
2. Nilai `approvedByPpic` bernilai **`true`** DAN `approvedByPm` bernilai **`true`**.

---

## 3. Implementasi Query Database

### Menggunakan Prisma Client (TypeScript/Node.js)
```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function getApprovedSPBs() {
  const approvedSpbList = await prisma.sPB.findMany({
    where: {
      status: "APPROVED",
      approvedByPpic: true,
      approvedByPm: true,
    },
    include: {
      project: {
        select: {
          projectNumber: true,
          projectName: true,
          customer: {
            select: {
              name: true,
              company: true,
            }
          }
        }
      },
      items: {
        where: {
          // Opsional: Hanya mengambil barang dengan sumber gudang (WAREHOUSE)
          source: "WAREHOUSE",
        },
        select: {
          id: true,
          materialId: true,
          name: true,
          typeMerk: true,
          qty: true,
          unit: true,
          status: true,
          qtyIssued: true,
        }
      }
    },
    orderBy: {
      createdAt: "desc",
    }
  });

  return approvedSpbList;
}
```

### Menggunakan Query SQL Murni (PostgreSQL)
Jika sistem Inventory terpisah langsung mengakses database SQL, Anda bisa menggunakan query di bawah ini:

```sql
SELECT 
    s.id AS spb_id,
    s.spb_number,
    s.date AS spb_date,
    p.project_number,
    p.project_name,
    si.id AS item_id,
    si.material_id,
    si.name AS material_name,
    si.type_merk,
    si.qty AS qty_requested,
    si.qty_issued,
    si.unit,
    si.source,
    si.status AS item_status
FROM spb s
JOIN projects p ON s.project_id = p.id
JOIN spb_items si ON s.id = si.spb_id
WHERE s.status = 'APPROVED'
  AND s.approved_by_ppic = TRUE
  AND s.approved_by_pm = TRUE
  AND si.source = 'WAREHOUSE' -- Filter barang gudang
ORDER BY s.created_at DESC;
```

---

## 4. Endpoint API Integrasi (Opsional)
Jika sistem Anda ingin mempublikasikan API internal agar dibaca oleh sistem Inventory via HTTP Request, gunakan JSON Response dengan format sebagai berikut:

**Request:** `GET /api/inventory/pending-spb`

**Response (JSON):**
```json
{
  "success": true,
  "data": [
    {
      "spbId": "d3b07384-d113-4a1e-8488-c70a8d8a7c29",
      "spbNumber": "SPB/PROJECT/07/2026/002-01",
      "projectName": "Rock Crusher",
      "projectNumber": "PROJECT-07-2026-002",
      "approvedAtPpic": "2026-07-15T07:44:00.000Z",
      "approvedAtPm": "2026-07-15T07:48:00.000Z",
      "items": [
        {
          "itemId": "b8f06079-88fa-4e78-958a-810e4a6a58bf",
          "materialId": "ab53c0e5-22f2-487b-891a-c797bca98c0c",
          "materialName": "EXPANDED - DMN 2028 / 3035",
          "typeMerk": "EXPANDED METAL DMN 2028 X 4' X 8'",
          "qtyRequested": 10.0,
          "qtyIssued": 0.0,
          "unit": "PCS",
          "status": "PENDING"
        }
      ]
    }
  ]
}
```

# 📦 Panduan Fetch Data Paket/Koli Hasil Validasi PPIC (Approved & Rejected)

Dokumen ini adalah panduan integrasi bagi tim pengembang modul lain (seperti **Modul Surat Jalan / Shipping**, **Modul Logistik Warehouse**, maupun **Sistem Eksternal**) untuk mengambil (*fetch*) data paket koli yang telah **disetujui (*APPROVED*)** atau **ditolak (*REJECTED*)** oleh PPIC.

---

## 📌 Ringkasan Status Validasi PPIC

Setiap koli/palet pada model `ShipmentPackage` memiliki atribut status PPIC sebagai berikut:

| Status (`ppicStatus`) | Deskripsi | Aksi Lanjutan pada Modul Lain |
| :--- | :--- | :--- |
| `APPROVED` | Paket **disetujui** oleh PPIC. Muatan dan alokasi kirim valid sesuai jadwal produksi. | **Boleh diterbitkan Surat Jalan**. Masuk ke daftar pilihan koli saat membuat Surat Jalan. |
| `REJECTED` | Paket **ditolak** oleh PPIC karena kuantitas berlebih, salah palet, atau jadwal belum pas. | **Diblokir dari Surat Jalan**. Tim Logistik harus melihat `ppicNotes` (alasan penolakan) untuk merevisi muatan. |
| `WAITING_APPROVAL` | Paket siap kirim (`READY_TO_SHIP`) namun **belum divalidasi** oleh PPIC. | Menunggu verifikasi. Belum bisa diterbitkan Surat Jalan. |

---

## 🛠️ Cara Fetch Data (3 Metode yang Tersedia)

Pengembang dapat memilih metode yang paling sesuai dengan arsitektur modul yang sedang dikerjakan:

---

### METODE 1: Fetch via REST API Endpoint (Frontend / Eksternal / Mobile)

Gunakan endpoint ini jika modul Anda berjalan di sisi *client-side*, aplikasi mobile, atau microservice terpisah.

#### 1.1. Fetch Paket yang Disetujui (APPROVED)
```http
GET /api/shipping/packages/ppic-approval?ppicStatus=APPROVED
```

*Contoh opsional jika ingin memfilter per Proyek tertentu:*
```http
GET /api/shipping/packages/ppic-approval?ppicStatus=APPROVED&projectId=cca77baf-f480-4b5c-b0ae-e03229142935
```

#### 1.2. Fetch Paket yang Ditolak (REJECTED)
```http
GET /api/shipping/packages/ppic-approval?ppicStatus=REJECTED
```

#### 1.3. Parameter Query URL:
| Parameter | Tipe | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `ppicStatus` | String | `WAITING_APPROVAL` | Nilai yang didukung: `APPROVED`, `REJECTED`, `WAITING_APPROVAL`, `ALL` |
| `projectId` | String (UUID) | *opsional* | Filter hanya paket milik project tertentu |

#### 1.4. Contoh Implementasi di TypeScript / JavaScript (Fetch Client):
```typescript
// Fetch data paket yang disetujui (siap buat Surat Jalan)
async function getApprovedPackages(projectId?: string) {
  const url = new URL("/api/shipping/packages/ppic-approval", window.location.origin);
  url.searchParams.set("ppicStatus", "APPROVED");
  if (projectId) url.searchParams.set("projectId", projectId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.packages; // Array of ShipmentPackage
}

// Fetch data paket yang ditolak (untuk panel revisi logistik)
async function getRejectedPackages(projectId?: string) {
  const url = new URL("/api/shipping/packages/ppic-approval", window.location.origin);
  url.searchParams.set("ppicStatus", "REJECTED");
  if (projectId) url.searchParams.set("projectId", projectId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.packages;
}
```

---

### METODE 2: Fetch via Next.js Server Action (Internal Next.js App)

Jika modul yang Anda kembangkan berada di dalam repositori yang sama (`Next.js App Router`), Anda dapat langsung memanggil Server Action yang sudah teruji.

#### Lokasi Action:
`src/app/actions/shipping.ts` -> fungsi `getShipmentPackagesForPpic(ppicStatus?: string)`

#### Contoh Penggunaan:
```typescript
import { getShipmentPackagesForPpic } from "@/app/actions/shipping";

// Di Server Component atau Client Component (useTransition / useEffect)
export async function loadPackagesData() {
  // 1. Ambil semua paket yang DISATUJUI oleh PPIC
  const approvedResult = await getShipmentPackagesForPpic("APPROVED");
  if (approvedResult.success) {
    const approvedList = approvedResult.data;
    console.log("Paket siap kirim:", approvedList);
  }

  // 2. Ambil semua paket yang DITOLAK oleh PPIC
  const rejectedResult = await getShipmentPackagesForPpic("REJECTED");
  if (rejectedResult.success) {
    const rejectedList = rejectedResult.data;
    console.log("Paket ditolak PPIC:", rejectedList);
  }
}
```

---

### METODE 3: Direct Database Query via Prisma ORM (Backend Service / Server Component)

Jika modul Anda memiliki akses langsung ke Prisma Client (`@/lib/prisma`):

```typescript
import prisma from "@/lib/prisma";

// 1. Query Paket yang Disetujui PPIC (Untuk Form Pembuatan Surat Jalan)
export async function getApprovedShipmentPackages(projectId?: string) {
  return await prisma.shipmentPackage.findMany({
    where: {
      status: "READY_TO_SHIP",
      ppicStatus: "APPROVED",
      shipmentId: null, // Belum pernah dimasukkan ke Surat Jalan lain
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: {
        include: {
          customer: true,
        },
      },
      project_components: true, // Rincian marking code, part name, dsb
    },
    orderBy: {
      ppicApprovedAt: "desc",
    },
  });
}

// 2. Query Paket yang Ditolak PPIC (Untuk Monitoring / Revisi Muatan)
export async function getRejectedShipmentPackages(projectId?: string) {
  return await prisma.shipmentPackage.findMany({
    where: {
      ppicStatus: "REJECTED",
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: {
        include: {
          customer: true,
        },
      },
      project_components: true,
    },
    orderBy: {
      ppicApprovedAt: "desc",
    },
  });
}
```

---

## 📋 Struktur Data Respon JSON & Field Kunci

Berikut adalah contoh payload objek paket yang dikembalikan:

```json
{
  "id": "70d10c0e-e5d8-4f11-97b0-c0abf105bb99",
  "code": "PKG-20260903-0001",
  "lotNo": "1",
  "packageType": "PALET",
  "qty": 2,
  "unit": "UNIT",
  "weight": 140.5,
  "dimensions": "1200x800x600",
  "cubication": 0.576,
  "status": "READY_TO_SHIP",
  "shipmentId": null,
  
  /* --- FIELD PENTING PPIC VALIDATION --- */
  "ppicStatus": "APPROVED",
  "ppicNotes": "Muatan sesuai alokasi pengiriman batch 1.",
  "ppicApprovedAt": "2026-09-08T03:15:00.000Z",
  "ppicApprovedBy": "Budi - PPIC Coordinator",
  "ppicRequestedAt": "2026-09-08T01:30:00.000Z",
  "ppicRequestedBy": "Tim Gudang Logistik",

  /* --- IDENTITAS PROYEK & CUSTOMER --- */
  "project": {
    "id": "cca77baf-f480-4b5c-b0ae-e03229142935",
    "projectName": "CONVEYOR SYSTEM LINE 3",
    "projectNumber": "SO-2026-0042",
    "customer": {
      "name": "Bpk. Hendra",
      "company": "PT. Surya Logistik Makmur",
      "address": "Kawasan Industri MM2100, Cikarang Barat",
      "phone": "08123456789",
      "email": "hendra@suryalogistik.co.id"
    }
  },

  /* --- ITEM KOMPONEN DALAM PAKET --- */
  "project_components": [
    {
      "id": "comp-uuid-001",
      "markingCode": "MK-CV-01",
      "name": "Roller Head Section 3m",
      "length": 3000,
      "width": 600,
      "height": 450,
      "weight": 70.25,
      "drawingNo": "DWG-2026-01"
    }
  ]
}
```

### Penjelasan Field Kunci untuk Modul Penerima:

1. **`ppicStatus`**:
   - Wajib dicek sebelum melakukan aksi penerbitan surat jalan. Pastikan bernilai `"APPROVED"`.
2. **`ppicNotes`**:
   - Jika `ppicStatus === "REJECTED"`, field ini **berisi alasan penolakan** dari PPIC (contoh: *"Kuantitas melebihi batch kirim minggu ini. Harap pisahkan per 1 unit"*). Wajib ditampilkan ke pengguna di modul logistik.
   - Jika `ppicStatus === "APPROVED"`, field ini berisi catatan persetujuan opsional dari PPIC.
3. **`ppicApprovedAt`**:
   - Waktu (ISO DateTime) ketika persetujuan/penolakan diputuskan oleh PPIC.
4. **`ppicApprovedBy`**:
   - Nama user/petugas PPIC yang memvalidasi koli tersebut.
5. **`project.customer`**:
   - Berisi informasi identitas customer lengkap (`name`, `company`, `address`, `phone`, `email`) untuk dicetak pada dokumen Surat Jalan.
6. **`project_components`**:
   - Daftar item komponen yang terbungkus di dalam palet/koli, lengkap dengan kode marking teknis.

---

## 🛡️ Business Logic & Validasi yang Wajib Diterapkan di Modul Surat Jalan

Untuk menjaga integritas alur pengiriman barang, tim modul pengiriman/surat jalan **wajib** menerapkan validasi berikut:

1. **Blokir Paket Non-Approved**:
   ```typescript
   if (pkg.ppicStatus !== "APPROVED") {
     throw new Error(`Paket ${pkg.code} belum disetujui oleh PPIC (Status: ${pkg.ppicStatus}). Surat Jalan tidak dapat dibuat.`);
   }
   ```
2. **Tampilkan Feedback Penolakan**:
   - Pada UI modul logistik, berikan badge status merah `Ditolak PPIC` pada paket berstatus `REJECTED`.
   - Sediakan tombol *"Lihat Alasan Penolakan"* yang menampilkan teks dari `pkg.ppicNotes` dan validator `pkg.ppicApprovedBy`.
3. **Reset Status Ketika Muatan Diedit**:
   - Jika tim logistik membongkar / merevisi item muatan di dalam koli yang ditolak, status paket harus dikembalikan ke `WAITING_APPROVAL` untuk diajukan ulang ke PPIC.

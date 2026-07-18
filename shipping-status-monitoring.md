# Dokumentasi Integrasi & Monitoring Status Eksekusi Shipping (Pengiriman)

Dokumentasi ini dibuat untuk mempermudah **Sistem A** (sistem eksternal) dalam memantau dan memonitoring alur status eksekusi pengiriman (shipping execution) barang, status armada (driver dan kendaraan), serta detail paket pengiriman dari database JLU Inventory Tracker.

---

## 1. Diagram Alur Eksekusi Pengiriman (Shipment Lifecycle)

Berikut adalah diagram transisi status pengiriman (`Shipment`) dan keterkaitannya dengan status armada serta paket barang:

```mermaid
stateDiagram-v2
    [*] --> READY_TO_SHIP : Shipping Dibuat (Logistik)
    
    state "Proses Penunjukan Armada (Purchasing)" as AssignFleet {
        READY_TO_SHIP --> READY_TO_SHIP : Driver & Kendaraan Ditunjuk
        note right of READY_TO_SHIP
            fleetRequestStatus = CONFIRMED
            Driver & Vehicle = ON_DUTY
        end note
    }

    state "Proses Pengiriman (Eksekusi)" as DeliveryProcess {
        READY_TO_SHIP --> IN_DELIVERY : Driver Berangkat / Dispatch
        note right of IN_DELIVERY
            Shipment status = IN_DELIVERY
            ShipmentPackage status = SHIPPED
        end note
        
        IN_DELIVERY --> DELIVERED : Sampai di Tujuan (Selesai)
        note right of DELIVERED
            Shipment status = DELIVERED
            Driver & Vehicle = AVAILABLE kembali
        end note

        IN_DELIVERY --> RETUR : Pengiriman Gagal / Retur
        note right of RETUR
            Shipment status = RETUR
            ShipmentPackage status = READY_TO_SHIP (Dilepas)
            Driver & Vehicle = AVAILABLE kembali
        end note
    }
```

---

## 2. Model Prisma & Tabel Database Terkait

Untuk memonitor status eksekusi pengiriman, **Sistem A** perlu mengakses data dari model-model Prisma berikut:

### 1. Model `Shipment` (Tabel `shipments`)
Menyimpan informasi utama surat jalan pengiriman, tujuan, metode pengiriman, status pengiriman, serta referensi armada.

| Nama Field (Prisma) | Nama Kolom (PostgreSQL) | Tipe Data | Deskripsi |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID (PK) | ID unik data pengiriman. |
| `suratJalanNo` | `suratJalanNo` | VARCHAR (Unique) | Nomor Surat Jalan resmi (Contoh: `SJ-20260608-4821`). |
| `projectId` | `projectId` | UUID (FK) | Relasi ke Proyek (`Project`). |
| `deliveryDate` | `deliveryDate` | TIMESTAMP | Tanggal pengiriman dijadwalkan. |
| `shippingMethod` | `shippingMethod` | VARCHAR | Metode: `INTERNAL_DELIVERY` atau `CUSTOMER_PICKUP`. |
| `destination` | `destination` | VARCHAR | Alamat tujuan pengiriman. |
| `status` | `status` | VARCHAR | Status eksekusi (Contoh: `READY_TO_SHIP`, `IN_DELIVERY`, `DELIVERED`, `RETUR`). |
| `fleetRequestStatus` | `fleetRequestStatus` | VARCHAR | Status alokasi armada (Contoh: `PENDING`, `CONFIRMED`). |
| `driverId` | `driverId` | UUID (FK) | Relasi ke Driver (`Driver`). |
| `vehicleId` | `vehicleId` | UUID (FK) | Relasi ke Kendaraan (`Vehicle`). |

### 2. Model `ShipmentPackage` (Tabel `shipment_packages`)
Menyimpan detail paket barang/marking yang dimasukkan ke dalam pengiriman tertentu.

| Nama Field (Prisma) | Nama Kolom (PostgreSQL) | Tipe Data | Deskripsi |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID (PK) | ID unik paket. |
| `code` | `code` | VARCHAR (Unique) | Kode unik marking paket (Contoh: `MRK-JLU-20260608-001`). |
| `lotNo` | `lotNo` | VARCHAR | Nomor Lot produksi paket. |
| `projectId` | `projectId` | UUID (FK) | Relasi ke Proyek (`Project`). |
| `itemId` | `itemId` | UUID (FK, Nullable)| Relasi ke barang inventory (`Item`). |
| `itemName` | `itemName` | VARCHAR | Nama barang dalam paket. |
| `qty` | `qty` | DOUBLE PRECISION | Jumlah barang dalam paket. |
| `unit` | `unit` | VARCHAR | Satuan barang (Contoh: `Pcs`, `Kg`). |
| `status` | `status` | VARCHAR | Status paket: `READY_TO_SHIP` atau `SHIPPED`. |
| `shipmentId` | `shipmentId` | UUID (FK, Nullable)| Relasi ke pengiriman (`Shipment`). |

### 3. Model `Driver` (Tabel `drivers`)
Menyimpan profil pengemudi yang ditugaskan untuk pengiriman.

| Nama Field (Prisma) | Nama Kolom (PostgreSQL) | Tipe Data | Deskripsi |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID (PK) | ID unik driver. |
| `name` | `name` | VARCHAR | Nama lengkap pengemudi. |
| `status` | `status` | VARCHAR | Status ketersediaan: `AVAILABLE`, `ON_DUTY`, `INACTIVE`. |

### 4. Model `Vehicle` (Tabel `vehicles`)
Menyimpan data armada kendaraan yang digunakan untuk operasional logistik.

| Nama Field (Prisma) | Nama Kolom (PostgreSQL) | Tipe Data | Deskripsi |
| :--- | :--- | :--- | :--- |
| `id` | `id` | UUID (PK) | ID unik kendaraan. |
| `name` | `name` | VARCHAR | Nama kendaraan (Contoh: `Blind Van Grandmax`). |
| `plateNumber` | `plateNumber` | VARCHAR (Unique) | Plat nomor kendaraan. |
| `status` | `status` | VARCHAR | Status kendaraan: `AVAILABLE`, `ON_DUTY`, `MAINTENANCE`, `INACTIVE`. |

---

## 3. Kamus Status (Status Reference Guide)

Untuk memahami keadaan pengiriman secara real-time, perhatikan kombinasi nilai status berikut:

### A. Status Pengiriman (`Shipment.status`)
* **`READY_TO_SHIP`** (Default)
  * **Deskripsi**: Surat Jalan sudah dibuat dan siap dikirim. Jika menggunakan metode `INTERNAL_DELIVERY`, pengiriman menunggu penugasan armada dari Purchasing.
* **`IN_DELIVERY`**
  * **Deskripsi**: Driver telah berangkat membawa barang. Pada tahap ini, semua status paket (`ShipmentPackage`) di dalam pengiriman ini otomatis berubah menjadi `SHIPPED`.
* **`DELIVERED`**
  * **Deskripsi**: Pengiriman telah selesai dan diterima dengan sukses di lokasi tujuan. Driver dan kendaraan dilepas kembali menjadi `AVAILABLE`.
* **`RETUR`**
  * **Deskripsi**: Pengiriman gagal atau barang dikembalikan. Paket di dalam pengiriman ini dikembalikan statusnya ke `READY_TO_SHIP` agar bisa dijadwalkan ulang pada pengiriman berikutnya. Driver dan kendaraan dibebaskan menjadi `AVAILABLE`.

### B. Status Permintaan Armada (`Shipment.fleetRequestStatus`)
* **`NOT_REQUESTED`**: Digunakan jika pelanggan mengambil sendiri barangnya (`CUSTOMER_PICKUP`).
* **`PENDING`**: Menunggu divisi Purchasing menunjuk Driver dan Kendaraan.
* **`CONFIRMED`**: Armada telah ditentukan. Driver dan Kendaraan otomatis diset statusnya menjadi `ON_DUTY`.

---

## 4. Contoh Query SQL untuk Monitoring (Sistem A)

Sistem A dapat menggunakan query SQL berikut langsung pada database PostgreSQL untuk memantau status pengiriman:

### A. Mendapatkan Status Real-Time Pengiriman berdasarkan Nomor Surat Jalan
Query ini menampilkan status pengiriman saat ini, informasi driver, kendaraan, serta total berat dan dimensi.

```sql
SELECT 
    s."suratJalanNo" AS "Nomor Surat Jalan",
    p."projectNumber" AS "Nomor Proyek",
    p."projectName" AS "Nama Proyek",
    s."destination" AS "Tujuan",
    s."deliveryDate" AS "Tanggal Kirim",
    s."status" AS "Status Pengiriman",
    s."fleetRequestStatus" AS "Status Alokasi Armada",
    d.name AS "Nama Driver",
    v.name AS "Kendaraan",
    v."plateNumber" AS "Plat Nomor"
FROM shipments s
JOIN projects p ON s."projectId" = p.id
LEFT JOIN drivers d ON s."driverId" = d.id
LEFT JOIN vehicles v ON s."vehicleId" = v.id
WHERE s."suratJalanNo" = 'SJ-20260608-4821';
```

### B. Melihat Daftar Paket (Marking) dalam Surat Jalan Tertentu
Query ini mengambil rincian paket barang apa saja yang dibawa dalam satu pengiriman.

```sql
SELECT 
    sp.code AS "Kode Paket/Marking",
    sp."lotNo" AS "Lot No",
    sp."itemName" AS "Nama Barang",
    sp.qty AS "Quantity",
    sp.unit AS "Satuan",
    sp.weight AS "Berat (Kg)",
    sp.dimensions AS "Dimensi",
    sp.status AS "Status Paket"
FROM shipment_packages sp
JOIN shipments s ON sp."shipmentId" = s.id
WHERE s."suratJalanNo" = 'SJ-20260608-4821';
```

### C. Memonitor Pengiriman yang Sedang Berjalan (Sedang dalam Perjalanan)
Sistem A dapat menampilkan daftar pengiriman aktif beserta status armada yang bertugas untuk live monitoring dashboard.

```sql
SELECT 
    s."suratJalanNo",
    s.destination,
    d.name AS driver_name,
    v."plateNumber" AS vehicle_plate,
    s."deliveryDate"
FROM shipments s
JOIN drivers d ON s."driverId" = d.id
JOIN vehicles v ON s."vehicleId" = v.id
WHERE s.status = 'IN_DELIVERY';
```

---

## 5. Monitoring Melalui API Internal (HTTP GET)

Jika Sistem A tidak memiliki akses langsung ke database PostgreSQL, Sistem A dapat melakukan pooling data ke REST API berikut:

### 1. GET `/api/shipping`
Mengambil daftar pengiriman yang terdaftar.
* **Query Parameters (Opsional)**:
  * `status`: Filter status pengiriman (Contoh: `/api/shipping?status=IN_DELIVERY`).
  * `projectId`: Filter pengiriman berdasarkan ID Proyek.
* **Contoh Response**:
  ```json
  {
    "shipments": [
      {
        "id": "7b0931db-9d8a-4d7a-8fef-3c97ea15d18d",
        "suratJalanNo": "SJ-20260608-1029",
        "deliveryDate": "2026-06-08T00:00:00.000Z",
        "shippingMethod": "INTERNAL_DELIVERY",
        "destination": "Workshop PT. Maju Bersama, Bekasi",
        "status": "IN_DELIVERY",
        "project": {
          "id": "9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
          "projectName": "Conveyor System",
          "projectNumber": "SO-2026-001"
        },
        "driver": {
          "id": "d1d2d3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
          "name": "Budi Santoso",
          "status": "ON_DUTY"
        },
        "vehicle": {
          "id": "v1v2v3v4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
          "name": "Truk CDE Engkel",
          "plateNumber": "B 9876 CDI",
          "status": "ON_DUTY"
        },
        "packages": [
          {
            "id": "p1p2p3p4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
            "code": "MRK-JLU-20260608-001",
            "itemName": "Frame Conveyor Section A",
            "qty": 1,
            "unit": "Unit",
            "status": "SHIPPED"
          }
        ]
      }
    ]
  }
  ```

### 2. GET `/api/shipping/[id]`
Mengambil detail satu pengiriman berdasarkan ID pengiriman.

### 3. GET `/api/shipping/packages`
Mengambil seluruh daftar paket marking pengiriman.
* **Query Parameters (Opsional)**:
  * `status`: Filter berdasarkan status paket (`READY_TO_SHIP` / `SHIPPED`).
  * `projectId`: Filter berdasarkan ID proyek.
  * `shipmentId`: Filter berdasarkan ID pengiriman (gunakan nilai `"null"` untuk paket yang belum dimasukkan ke pengiriman).

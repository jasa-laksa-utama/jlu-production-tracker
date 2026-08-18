# 📘 Dokumen Panduan Integrasi API: SPB Gudang & Approval (Sistem A)

Dokumen ini berisi spesifikasi teknis dan instruksi lengkap bagi **Sistem A (Sistem Eksternal)** untuk melakukan:
1. **Pengambilan Data SPB Gudang** (List & Detail SPB Gudang beserta Item & Data Vendor).
2. **Pembaruan Status Approval Stage 1 (PPIC)** pada SPB Gudang.
3. **Pembaruan Status Approval Stage 2 (DIREKSI)** pada SPB Gudang.
4. **Pembaruan Status & Penetapan Vendor (Purchasing)**.

---

## 🌐 Base URL & Autentikasi

* **Base URL**: `http://localhost:3000/api` (sesuaikan dengan host/domain server)
* **Header Default**:
  ```http
  Content-Type: application/json
  Cookie: auth_token=<JWT_TOKEN_VALID> (atau Authorization Bearer jika diizinkan)
  ```

---

## 1. 📥 Pengambilan Data SPB Gudang (GET List & Filter)

### 🔹 Endpoint:
```http
GET /api/spb
```

### 🔹 Query Parameters:
| Parameter | Tipe | Contoh Nilai | Keterangan |
| :--- | :--- | :--- | :--- |
| `spbType` | String | `GUDANG` | Filter khusus untuk mengambil data SPB Gudang saja |
| `source` | String | `WAREHOUSE` / `TRADING` / `TRADING_APPROVED` | Filter sumber barang (`WAREHOUSE` = Stok, `TRADING` = Pembelian Baru) |
| `status` | String | `PENDING_APPROVAL`, `PENDING_DIREKSI`, `APPROVED` | Filter status pengajuan SPB |

---

### 🔹 Contoh Request:
```http
GET /api/spb?spbType=GUDANG HTTP/1.1
Host: localhost:3000
Content-Type: application/json
```

---

### 🔹 Contoh Respon JSON (200 OK):
```json
{
  "spbList": [
    {
      "id": "cca77baf-f480-4b5c-b0ae-e03229142935",
      "spbNumber": "SPB-GDG-20260812-0001",
      "spbType": "GUDANG",
      "projectId": null,
      "date": "2026-08-12T09:35:26.519Z",
      "status": "APPROVED",
      "makerName": "Super Admin",
      "approvedByPpic": true,
      "approvedByPpicAt": "2026-08-13T04:09:54.730Z",
      "approvedByDireksi": true,
      "approvedByDireksiAt": "2026-08-13T04:35:02.171Z",
      "rejectedReason": null,
      "rejectedAt": null,
      "createdAt": "2026-08-12T09:35:26.727Z",
      "updatedAt": "2026-08-13T04:35:02.173Z",
      "canCreateMemo": true,
      "isFullyReturned": false,
      "items": [
        {
          "id": "be4a2c31-1f6e-45d0-89f3-516c9a26e9a9",
          "spbGudangId": "cca77baf-f480-4b5c-b0ae-e03229142935",
          "materialId": "f398c548-05b2-4f22-abb8-8b837e6a644f",
          "name": "BOR RUSIA",
          "typeMerk": "RPM: 1000 | MERK: RUSIA | MODEL: FCL 12",
          "qty": 3,
          "unit": "UNIT",
          "source": "WAREHOUSE",
          "note": "Alokasi dari Stok Gudang",
          "status": "APPROVED_WAREHOUSE",
          "approvalPpic": "APPROVED",
          "approvalPm": "NONE",
          "approvalDireksi": "APPROVED",
          "selectedSupplierId": null,
          "selectedSupplierName": null,
          "selectedCatalogPrice": null,
          "vendorSelectionStatus": "NONE"
        },
        {
          "id": "ed83d615-74e3-4645-bc2d-5bc4c6512c9d",
          "spbGudangId": "cca77baf-f480-4b5c-b0ae-e03229142935",
          "materialId": "f398c548-05b2-4f22-abb8-8b837e6a644f",
          "name": "BOR RUSIA",
          "typeMerk": "RPM: 1000 | MERK: RUSIA | MODEL: FCL 12",
          "qty": 2,
          "unit": "UNIT",
          "source": "TRADING",
          "note": "Kekurangan stok gudang (Trading / PO Pembelian)",
          "status": "PO_PENDING",
          "approvalPpic": "APPROVED",
          "approvalPm": "APPROVED",
          "approvalDireksi": "APPROVED",
          "selectedSupplierId": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
          "selectedSupplierName": "PT RUSIA UTAMA",
          "selectedCatalogPrice": 1500000,
          "vendorSelectionStatus": "APPROVED"
        }
      ]
    }
  ]
}
```

---

## 2. 📑 Update Approval Stage 1 — PPIC (API PATCH)

Sistem A dapat menyetujui (`APPROVE`) atau menolak (`REJECT`) SPB Gudang pada tingkat PPIC.

### 🔹 Endpoint:
```http
PATCH /api/spb/approval
```

### 🔹 A. Request Body (PPIC APPROVE):
```json
{
  "spbId": "cca77baf-f480-4b5c-b0ae-e03229142935",
  "stage": "PPIC",
  "action": "APPROVE",
  "validatorName": "User PPIC Sistem A"
}
```
* **Efek Pada Database**:
  - `spb_gudang.status` $\rightarrow$ `'PENDING_DIREKSI'`
  - `spb_gudang.approvedByPpic` $\rightarrow$ `true`
  - `spb_gudang.approvedByPpicAt` $\rightarrow$ Waktu saat ini (`NOW()`)
  - `spb_gudang_items.approvalPpic` $\rightarrow$ `'APPROVED'`
  - `spb_gudang_items.approvalDireksi` $\rightarrow$ `'PENDING'`

---

### 🔹 B. Request Body (PPIC REJECT):
```json
{
  "spbId": "cca77baf-f480-4b5c-b0ae-e03229142935",
  "stage": "PPIC",
  "action": "REJECT",
  "rejectedReason": "Spesifikasi tidak sesuai standar produksi",
  "validatorName": "User PPIC Sistem A"
}
```
* **Efek Pada Database**:
  - `spb_gudang.status` $\rightarrow$ `'REJECTED'`
  - `spb_gudang.rejectedReason` $\rightarrow$ Alasan penolakan
  - `spb_gudang_items.status` $\rightarrow$ `'REJECTED'`

---

### 🔹 Respon JSON Sukses (200 OK):
```json
{
  "success": true,
  "message": "SPB Gudang #SPB-GDG-20260812-0001 telah disetujui PPIC. Menunggu validasi Direksi.",
  "spb": {
    "id": "cca77baf-f480-4b5c-b0ae-e03229142935",
    "status": "PENDING_DIREKSI",
    "approvedByPpic": true
  }
}
```

---

## 3. 👑 Update Approval Stage 2 — DIREKSI (API PATCH)

Setelah PPIC menyetujui (`approvedByPpic: true`), Sistem A dapat memproses validasi Direksi.

### 🔹 Endpoint:
```http
PATCH /api/spb/approval
```

### 🔹 A. Request Body (DIREKSI APPROVE):
```json
{
  "spbId": "cca77baf-f480-4b5c-b0ae-e03229142935",
  "stage": "DIREKSI",
  "action": "APPROVE",
  "validatorName": "Direksi Sistem A"
}
```
* **Efek Pada Database**:
  - `spb_gudang.status` $\rightarrow$ `'APPROVED'`
  - `spb_gudang.approvedByDireksi` $\rightarrow$ `true`
  - `spb_gudang.approvedByDireksiAt` $\rightarrow$ Waktu saat ini (`NOW()`)
  - Item dengan `source = 'TRADING'`: status item $\rightarrow$ `'PO_PENDING'` (Siap diproses ke Purchase Order).
  - Item dengan `source = 'WAREHOUSE'`: status item $\rightarrow$ `'APPROVED_WAREHOUSE'` (Siap diterbitkan Memo Pengeluaran Barang).

---

### 🔹 B. Request Body (DIREKSI REJECT):
```json
{
  "spbId": "cca77baf-f480-4b5c-b0ae-e03229142935",
  "stage": "DIREKSI",
  "action": "REJECT",
  "rejectedReason": "Budgeting triwulan tidak mencukupi",
  "validatorName": "Direksi Sistem A"
}
```
* **Efek Pada Database**:
  - `spb_gudang.status` $\rightarrow$ `'REJECTED'`
  - `spb_gudang.approvedByDireksi` $\rightarrow$ `false`
  - `spb_gudang_items.status` $\rightarrow$ `'REJECTED'`

---

### 🔹 Respon JSON Sukses (200 OK):
```json
{
  "success": true,
  "message": "SPB Gudang #SPB-GDG-20260812-0001 telah disetujui penuh oleh Direksi.",
  "spb": {
    "id": "cca77baf-f480-4b5c-b0ae-e03229142935",
    "status": "APPROVED",
    "approvedByDireksi": true
  }
}
```

---

## 4. 🛍️ Penetapan & Approval Vendor SPB Gudang (Purchasing)

Untuk barang `TRADING`, Sistem A juga dapat menetapkan vendor & harga deal:

### 🔹 Endpoint Penetapan Vendor:
```http
POST /api/spb/items/select-supplier
```

### 🔹 Request Body:
```json
{
  "spbItemId": "ed83d615-74e3-4645-bc2d-5bc4c6512c9d",
  "supplierId": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
  "supplierName": "PT RUSIA UTAMA",
  "price": 1500000,
  "qtyToBind": 2,
  "vendorSelectionNote": "Harga promo garansi resmi 1 tahun"
}
```

### 🔹 Respon JSON (200 OK):
```json
{
  "message": "Vendor terpilih (PT RUSIA UTAMA) & harga Rp 1.500.000 berhasil diajukan!",
  "item": {
    "id": "ed83d615-74e3-4645-bc2d-5bc4c6512c9d",
    "selectedSupplierName": "PT RUSIA UTAMA",
    "selectedCatalogPrice": 1500000,
    "vendorSelectionStatus": "APPROVED",
    "status": "PO_PENDING"
  }
}
```

---

## 📊 Matriks Ringkasan Status Workflow SPB Gudang

| Status SPB (`spb_gudang.status`) | `approvedByPpic` | `approvedByDireksi` | Posisi Aliran Sistem |
| :--- | :--- | :--- | :--- |
| `PENDING_APPROVAL` | `false` | `false` | Menunggu Approval Stage 1 (PPIC) |
| `PENDING_DIREKSI` | `true` | `false` | Menunggu Approval Stage 2 (Direksi) |
| `APPROVED` | `true` | `true` | SPB Disetujui Penuh (Masuk ke PO / Pengeluaran Gudang) |
| `REJECTED` | `false` | `false` | Ditolak oleh PPIC / Direksi |

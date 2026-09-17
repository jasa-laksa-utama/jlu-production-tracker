export function calculateRealProcurementProgress(
  project: any,
  cutoffDate?: Date,
): number {
  if (!project) return 0;

  const isHistorical = cutoffDate && cutoffDate.getTime() < Date.now();

  // Kumpulkan seluruh SPB items dari proyek
  const rawSpbList = project.spb || project.spbs || [];
  const spbList = isHistorical
    ? rawSpbList.filter((s: any) => {
        const d = s.createdAt || s.approvedByPmAt || s.approvedByPpicAt;
        return d && new Date(d).getTime() <= cutoffDate.getTime();
      })
    : rawSpbList;

  let allItems: any[] = [];

  spbList.forEach((s: any) => {
    if (s.items && Array.isArray(s.items)) {
      const items = isHistorical
        ? s.items.filter((it: any) => {
            const d = it.createdAt || it.updatedAt;
            return d && new Date(d).getTime() <= cutoffDate.getTime();
          })
        : s.items;
      allItems.push(...items);
    }
  });

  // Jika spbItems ada di level project
  if (project.spbItems && Array.isArray(project.spbItems)) {
    const pItems = isHistorical
      ? project.spbItems.filter((it: any) => {
          const d = it.createdAt || it.updatedAt;
          return d && new Date(d).getTime() <= cutoffDate.getTime();
        })
      : project.spbItems;
    allItems.push(...pItems);
  }

  // Deduplikasi berdasarkan id jika ada
  const uniqueItemsMap = new Map();
  allItems.forEach((item) => {
    if (item && item.id) {
      uniqueItemsMap.set(item.id, item);
    }
  });
  const uniqueItems = Array.from(uniqueItemsMap.values());

  if (uniqueItems.length === 0) {
    // Jika belum ada item SPB tapi ada SPB dibuat sebelum cutoff
    if (spbList.length > 0) return 20;
    return 0;
  }

  let totalScore = 0;
  uniqueItems.forEach((item) => {
    let score = 0;

    const isFullyReceived =
      item.status === "RECEIVED" ||
      item.status === "COMPLETED" ||
      (item.qtyIssued && parseFloat(item.qtyIssued) >= parseFloat(item.qty || "0"));

    const isQcPassed =
      item.status === "QC_PASSED" ||
      item.qcStatus === "PASSED" ||
      item.qcStatus === "APPROVED";

    const isArrivedInWarehouse =
      item.status === "IN_QC" ||
      item.status === "DELIVERED" ||
      item.qcStatus === "PENDING_INSPECTION" ||
      item.qcStatus === "PARTIAL";

    const isPoOrderedOrProcessing =
      item.status === "PO_PROCESSING" ||
      item.status === "ORDERED" ||
      item.status === "IN_TRANSIT" ||
      item.status === "SHIPPED";

    const isPoCreatedOrVendorFinal =
      item.status === "PO_PENDING" ||
      item.vendorSelectionStatus === "APPROVED" ||
      item.approvalDireksi === "APPROVED";

    const isPmApproved =
      item.approvalPm === "APPROVED";

    const isPpicApproved =
      item.approvalPpic === "APPROVED";

    const isRecommendationSubmitted =
      item.vendorSelectionStatus === "SUBMITTED" ||
      item.vendorSelectionStatus === "PENDING_PPIC" ||
      item.approvalEngineering === "APPROVED" ||
      !!item.selectedSupplierName ||
      !!item.selectedSupplierId;

    if (isFullyReceived) {
      score = 100; // Pilar 3.3: Barang fisik diterima penuh di gudang & diproses inventory (100%)
    } else if (isQcPassed) {
      score = 90;  // Pilar 3.2: Barang tiba & telah lolos inspeksi QC (90%)
    } else if (isArrivedInWarehouse) {
      score = 75;  // Pilar 3.1: Barang telah tiba secara fisik & masuk antrean/proses QC (75%)
    } else if (isPoOrderedOrProcessing) {
      score = 60;  // Pilar 2.2: PO telah diproses / dipesan ke vendor (60%)
    } else if (isPoCreatedOrVendorFinal) {
      // PO terbit (45%) atau vendor disetujui Direksi (30%)
      score = item.status === "PO_PENDING" ? 45 : 30;
    } else if (isPmApproved) {
      score = 24;  // Pilar 1.3: Rekomendasi vendor disetujui PM (24%)
    } else if (isPpicApproved) {
      score = 18;  // Pilar 1.2: Rekomendasi vendor disetujui PPIC (18%)
    } else if (isRecommendationSubmitted) {
      score = 10;  // Pilar 1.1: Pengajuan rekomendasi vendor diajukan (10%)
    } else {
      score = 0;
    }

    totalScore += score;
  });

  return Math.min(100, Math.round(totalScore / uniqueItems.length));
}

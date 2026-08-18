export function calculateRealProcurementProgress(project: any): number {
  if (!project) return 0;

  // Kumpulkan seluruh SPB items dari proyek
  const spbList = project.spb || project.spbs || [];
  let allItems: any[] = [];

  spbList.forEach((s: any) => {
    if (s.items && Array.isArray(s.items)) {
      allItems.push(...s.items);
    }
  });

  // Jika spbItems ada di level project
  if (project.spbItems && Array.isArray(project.spbItems)) {
    allItems.push(...project.spbItems);
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
    // Jika belum ada item SPB tapi ada SPB dibuat
    if (spbList.length > 0) return 20;
    return 0;
  }

  let totalScore = 0;
  uniqueItems.forEach((item) => {
    let score = 0;

    const isReceivedInWarehouse =
      item.status === "RECEIVED" ||
      (item.qtyIssued && parseFloat(item.qtyIssued) >= parseFloat(item.qty || "0"));

    const isPoProcessed =
      item.vendorSelectionStatus === "APPROVED" ||
      !!item.selectedSupplierId ||
      !!item.selectedSupplierName;

    const isRecommendationSubmitted =
      item.vendorSelectionStatus === "SUBMITTED" ||
      item.approvalEngineering === "APPROVED" ||
      item.approvalPm === "APPROVED";

    if (isReceivedInWarehouse) {
      score = 100; // Tahap 3: Barang/PO sudah sampai digudang
    } else if (isPoProcessed) {
      score = 66; // Tahap 2: PO diproses / vendor ditetapkan
    } else if (isRecommendationSubmitted) {
      score = 33; // Tahap 1: Pengajuan penawaran rekomendasi vendor diproses
    } else {
      score = 0;
    }

    totalScore += score;
  });

  return Math.min(100, Math.round(totalScore / uniqueItems.length));
}

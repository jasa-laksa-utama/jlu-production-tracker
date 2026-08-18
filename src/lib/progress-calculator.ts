import { STRUCTURE_WEIGHTS, MECHANICAL_WEIGHTS } from "./progress-weights";

// =============================================
// LEVEL 1: Hitung progress 1 item Structure (0 - 100)
// =============================================
export function calcStructureItemProgress(item: {
  qty?: number;
  cuttingQty?: number;
  settingQty?: number;
  weldingQty?: number;
  finishingQty?: number;
  paintingQty?: number;
  packagingQty?: number;
  cuttingDone?: boolean;
  settingDone?: boolean;
  weldingDone?: boolean;
  finishingDone?: boolean;
  paintingDone?: boolean;
  packagingDone?: boolean;
}): number {
  const qty = Math.max(1, Number(item.qty || 1));

  const cQty = item.cuttingQty !== undefined ? Number(item.cuttingQty) : (item.cuttingDone ? qty : 0);
  const sQty = item.settingQty !== undefined ? Number(item.settingQty) : (item.settingDone ? qty : 0);
  const wQty = item.weldingQty !== undefined ? Number(item.weldingQty) : (item.weldingDone ? qty : 0);
  const fQty = item.finishingQty !== undefined ? Number(item.finishingQty) : (item.finishingDone ? qty : 0);
  const pQty = item.paintingQty !== undefined ? Number(item.paintingQty) : (item.paintingDone ? qty : 0);
  const kQty = item.packagingQty !== undefined ? Number(item.packagingQty) : (item.packagingDone ? qty : 0);

  const cFrac = Math.min(1, Math.max(0, cQty / qty));
  const sFrac = Math.min(1, Math.max(0, sQty / qty));
  const wFrac = Math.min(1, Math.max(0, wQty / qty));
  const fFrac = Math.min(1, Math.max(0, fQty / qty));
  const pFrac = Math.min(1, Math.max(0, pQty / qty));
  const kFrac = Math.min(1, Math.max(0, kQty / qty));

  return (
    cFrac * STRUCTURE_WEIGHTS.cutting +
    sFrac * STRUCTURE_WEIGHTS.setting +
    wFrac * STRUCTURE_WEIGHTS.welding +
    fFrac * STRUCTURE_WEIGHTS.finishing +
    pFrac * STRUCTURE_WEIGHTS.painting +
    kFrac * STRUCTURE_WEIGHTS.packaging
  ) * 100;
}

export function calcMechanicalItemProgress(item: {
  qty?: number;
  procurementQty?: number;
  poQty?: number;
  fabricationQty?: number;
  packagingQty?: number;
  procurementDone?: boolean;
  poDone?: boolean;
  fabricationDone?: boolean;
  packagingDone?: boolean;
}): number {
  const qty = Math.max(1, Number(item.qty || 1));

  const procQty = item.procurementQty !== undefined ? Number(item.procurementQty) : (item.procurementDone ? qty : 0);
  const poQty = item.poQty !== undefined ? Number(item.poQty) : (item.poDone ? qty : 0);
  const fabQty = item.fabricationQty !== undefined ? Number(item.fabricationQty) : (item.fabricationDone ? qty : 0);
  const packQty = item.packagingQty !== undefined ? Number(item.packagingQty) : (item.packagingDone ? qty : 0);

  const procFrac = Math.min(1, Math.max(0, procQty / qty));
  const poFrac = Math.min(1, Math.max(0, poQty / qty));
  const fabFrac = Math.min(1, Math.max(0, fabQty / qty));
  const packFrac = Math.min(1, Math.max(0, packQty / qty));

  return (
    procFrac * MECHANICAL_WEIGHTS.procurement +
    poFrac * MECHANICAL_WEIGHTS.po +
    fabFrac * MECHANICAL_WEIGHTS.fabrication +
    packFrac * MECHANICAL_WEIGHTS.packaging
  ) * 100;
}

// =============================================
// LEVEL 2: Hitung progress rata-rata semua item dalam unit
// =============================================
export function calcUnitProgress(
  structureItems: Array<{ progressPercent: number | string | any; qty: number }>,
  mechanicalItems: Array<{ progressPercent: number | string | any; qty: number }>,
  unitType: "STRUCTURE" | "MECHANICAL" | "BOTH" | string
): number {
  const sItems = unitType !== "MECHANICAL" ? structureItems : [];
  const mItems = unitType !== "STRUCTURE" ? mechanicalItems : [];
  const allItems = [...sItems, ...mItems];
  
  if (allItems.length === 0) return 0;
  
  let totalWeightedProgress = 0;
  let totalQty = 0;
  
  for (const item of allItems) {
    const progress = typeof item.progressPercent === "object" 
      ? Number(item.progressPercent?.toString() || 0) 
      : Number(item.progressPercent || 0);
    const qty = Number(item.qty || 1);
    
    totalWeightedProgress += progress * qty;
    totalQty += qty;
  }
  
  return totalQty > 0 ? totalWeightedProgress / totalQty : 0;
}

// =============================================
// LEVEL 3: Hitung progress fase dari semua unit
// =============================================
export function calcPhaseProgress(
  unitProgresses: Array<{ 
    actualPercent: number | string | any; 
    weightPercent: number | string | any;
  }>
): number {
  if (unitProgresses.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const up of unitProgresses) {
    const actual = typeof up.actualPercent === "object" 
      ? Number(up.actualPercent?.toString() || 0) 
      : Number(up.actualPercent || 0);
    const weight = typeof up.weightPercent === "object" 
      ? Number(up.weightPercent?.toString() || 0) 
      : Number(up.weightPercent || 0);
      
    weightedSum += actual * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// =============================================
// LEVEL 4: Hitung progress total proyek
// =============================================
export function calcProjectTotalProgress(
  phases: Array<{
    weightPercent: number | string | any;
    actualProgress: number | string | any;
  }>
): number {
  let total = 0;
  for (const phase of phases) {
    const actual = typeof phase.actualProgress === "object" 
      ? Number(phase.actualProgress?.toString() || 0) 
      : Number(phase.actualProgress || 0);
    const weight = typeof phase.weightPercent === "object" 
      ? Number(phase.weightPercent?.toString() || 0) 
      : Number(phase.weightPercent || 0);
      
    total += (actual * weight) / 100;
  }
  return total;
}

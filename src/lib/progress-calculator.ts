import { STRUCTURE_WEIGHTS, MECHANICAL_WEIGHTS } from "./progress-weights";

// =============================================
// LEVEL 1: Hitung progress 1 item Structure (0 - 100)
// =============================================
export function calcStructureItemProgress(item: {
  cuttingDone: boolean;
  settingDone: boolean;
  weldingDone: boolean;
  finishingDone: boolean;
  paintingDone: boolean;
  packagingDone: boolean;
}): number {
  return (
    (item.cuttingDone   ? STRUCTURE_WEIGHTS.cutting   : 0) +
    (item.settingDone   ? STRUCTURE_WEIGHTS.setting   : 0) +
    (item.weldingDone   ? STRUCTURE_WEIGHTS.welding   : 0) +
    (item.finishingDone ? STRUCTURE_WEIGHTS.finishing  : 0) +
    (item.paintingDone  ? STRUCTURE_WEIGHTS.painting   : 0) +
    (item.packagingDone ? STRUCTURE_WEIGHTS.packaging  : 0)
  ) * 100;
}

// =============================================
// LEVEL 1: Hitung progress 1 item Mechanical (0 - 100)
// =============================================
export function calcMechanicalItemProgress(item: {
  procurementDone: boolean;
  poDone: boolean;
  fabricationDone: boolean;
  packagingDone: boolean;
}): number {
  return (
    (item.procurementDone ? MECHANICAL_WEIGHTS.procurement : 0) +
    (item.poDone          ? MECHANICAL_WEIGHTS.po          : 0) +
    (item.fabricationDone ? MECHANICAL_WEIGHTS.fabrication : 0) +
    (item.packagingDone   ? MECHANICAL_WEIGHTS.packaging   : 0)
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

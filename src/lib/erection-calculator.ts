export const ERECTION_WEIGHTS = {
  sett: 0.30,     // 30% Setting / Penyetelan
  install: 0.65,  // 65% Instalasi (Kumulatif: 95%)
  finish: 0.05,   // 5%  Finishing / Alignment (Kumulatif: 100%)
};

/**
 * Calculates Erection progress (0-100%) for an item based on its Sett, Install, and Finish quantities/checkboxes.
 */
export function calcErectionItemProgress(item: {
  qty?: number | null;
  erectionSettQty?: number | null;
  erectionInstallQty?: number | null;
  erectionFinishQty?: number | null;
  erectionSettDone?: boolean | null;
  erectionInstallDone?: boolean | null;
  erectionFinishDone?: boolean | null;
}): number {
  const qty = Math.max(1, Number(item.qty) || 1);
  
  const settQty = item.erectionSettQty !== undefined && item.erectionSettQty !== null
    ? Number(item.erectionSettQty)
    : (item.erectionSettDone ? qty : 0);

  const installQty = item.erectionInstallQty !== undefined && item.erectionInstallQty !== null
    ? Number(item.erectionInstallQty)
    : (item.erectionInstallDone ? qty : 0);

  const finishQty = item.erectionFinishQty !== undefined && item.erectionFinishQty !== null
    ? Number(item.erectionFinishQty)
    : (item.erectionFinishDone ? qty : 0);

  const settFrac = Math.min(1, Math.max(0, settQty / qty));
  const installFrac = Math.min(1, Math.max(0, installQty / qty));
  const finishFrac = Math.min(1, Math.max(0, finishQty / qty));

  const total =
    settFrac * ERECTION_WEIGHTS.sett +
    installFrac * ERECTION_WEIGHTS.install +
    finishFrac * ERECTION_WEIGHTS.finish;

  return Math.min(100, Math.round(total * 10000) / 100);
}

/**
 * Calculates average Erection progress for a Conveyor Unit based on all its components (Structure & Mechanical).
 */
export function calcUnitErectionProgress(
  structureItems: any[] = [],
  mechanicalItems: any[] = []
): number {
  const allItems = [...structureItems, ...mechanicalItems];
  if (allItems.length === 0) return 0;

  const totalProgress = allItems.reduce(
    (sum, item) => sum + calcErectionItemProgress(item),
    0
  );

  return Math.min(100, Math.round((totalProgress / allItems.length) * 100) / 100);
}

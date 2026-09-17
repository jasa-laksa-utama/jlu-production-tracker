import { calculateRealProcurementProgress } from "@/lib/procurement-calculator";
import { calcUnitProgress, calcPhaseProgress } from "@/lib/progress-calculator";

/**
 * Helper to get an item's progress at a specific historical cutoff date.
 * Strictly matches the specific item name and unit to prevent ghost progress contagion.
 */
export function getItemProgressAtCutoff(
  item: any,
  type: string,
  unitName: string,
  project: any,
  cutoffDate: Date,
): number {
  const currentProg = Number(item.progressPercent || 0);
  if (currentProg === 0) return 0;

  // If cutoffDate is >= current time, return current progress
  if (cutoffDate.getTime() >= Date.now()) {
    return currentProg;
  }

  // Check production logs specifically for this item
  if (project?.productionLogs && Array.isArray(project.productionLogs)) {
    const itemName = (item.name || "").trim();
    const cleanUnit = (unitName || "").trim();

    // Only filter logs that explicitly mention this item's name
    const itemLogs = project.productionLogs.filter((l: any) => {
      const msg = l.message || "";
      if (!msg.toLowerCase().includes("progress item") && !msg.toLowerCase().includes("rincian komponen")) {
        return false;
      }
      const hasItemName = msg.includes(`"${itemName}"`) || msg.includes(itemName);
      if (!hasItemName) return false;
      if (cleanUnit && !msg.includes(cleanUnit)) return false;
      return true;
    });

    if (itemLogs.length > 0) {
      // Sort logs explicitly ascending by createdAt (oldest -> newest)
      const sortedLogs = [...itemLogs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      const logsBeforeCutoff = sortedLogs.filter(
        (l) => new Date(l.createdAt).getTime() <= cutoffDate.getTime(),
      );

      if (logsBeforeCutoff.length > 0) {
        // Pick the latest progress recorded on or before cutoffDate
        for (let i = logsBeforeCutoff.length - 1; i >= 0; i--) {
          const match = logsBeforeCutoff[i].message.match(/menjadi\s+([\d.]+)\%/i);
          if (match && match[1]) {
            return Number(match[1]);
          }
        }
      } else {
        // If there are logs for this item, but all happened AFTER cutoffDate,
        // it had 0% progress at this historical cutoffDate.
        return 0;
      }
    }
  }

  // Fallback: If no logs exist at all for this item
  const itemUpdatedTime = new Date(item.updatedAt || item.createdAt).getTime();
  if (itemUpdatedTime <= cutoffDate.getTime()) {
    return currentProg;
  }

  return 0;
}

/**
 * Helper to get an item's erection progress at a specific historical cutoff date.
 */
function getItemErectionProgressAtCutoff(
  item: any,
  unitName: string,
  project: any,
  cutoffDate: Date,
): number {
  const currentProg = Number(item.erectionProgress || 0);
  if (currentProg === 0) return 0;

  if (cutoffDate.getTime() >= Date.now()) {
    return currentProg;
  }

  if (project?.productionLogs && Array.isArray(project.productionLogs)) {
    const itemName = (item.name || "").trim();
    const cleanUnit = (unitName || "").trim();

    const itemLogs = project.productionLogs.filter((l: any) => {
      const msg = l.message || "";
      if (!msg.toLowerCase().includes("erection")) return false;
      const hasItemName = msg.includes(`"${itemName}"`) || msg.includes(itemName);
      if (!hasItemName) return false;
      if (cleanUnit && !msg.includes(cleanUnit)) return false;
      return true;
    });

    if (itemLogs.length > 0) {
      const sortedLogs = [...itemLogs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const logsBeforeCutoff = sortedLogs.filter(
        (l) => new Date(l.createdAt).getTime() <= cutoffDate.getTime(),
      );

      if (logsBeforeCutoff.length > 0) {
        for (let i = logsBeforeCutoff.length - 1; i >= 0; i--) {
          const match = logsBeforeCutoff[i].message.match(/menjadi\s+([\d.]+)\%/i);
          if (match && match[1]) {
            return Number(match[1]);
          }
        }
      } else {
        return 0;
      }
    }
  }

  const itemUpdatedTime = new Date(item.updatedAt || item.createdAt).getTime();
  if (itemUpdatedTime <= cutoffDate.getTime()) {
    return currentProg;
  }

  return 0;
}

/**
 * Helper utility to calculate phase progress at a specific historical cutoff date.
 */
export function getPhaseProgressAtCutoff(
  phase: any,
  project: any,
  cutoffDate: Date,
): number {
  const code = (phase?.code || phase?.name || "").toUpperCase();

  // 1. Procurement Cutoff
  if (code.includes("PROCURE") || code.includes("PPIC")) {
    return calculateRealProcurementProgress(project, cutoffDate);
  }

  // 2. Engineering Cutoff
  if (code.includes("ENG")) {
    const boqs = project?.boqs || [];
    const boqApproved = boqs.find((b: any) => {
      if (b.boqStatus !== "APPROVED") return false;
      const date = b.updatedAt || b.boqApprovedByPmAt || b.boqApprovedByPpicAt || b.createdAt;
      return date && new Date(date).getTime() <= cutoffDate.getTime();
    });

    if (boqApproved || (project?.boqApprovedAt && new Date(project.boqApprovedAt).getTime() <= cutoffDate.getTime())) {
      return 100;
    }

    const docs = (project?.documents || []).filter((d: any) => {
      return d.createdAt && new Date(d.createdAt).getTime() <= cutoffDate.getTime();
    });
    if (docs.length > 0) {
      const hasDrawing = docs.some((d: any) => d.category === "DRAWING" || d.category === "BRIEF");
      return hasDrawing ? 70 : 30;
    }

    return 0;
  }

  // 3. Fabrication Structure & Mechanical (or any Conveyor Units / Items)
  if (
    code.includes("FAB") ||
    code.includes("STRUKTUR") ||
    code.includes("MEKANIKAL") ||
    code.includes("STRUCTURE") ||
    code.includes("MECHANICAL")
  ) {
    const units = project?.conveyorUnits || [];
    if (units.length > 0) {
      const isStructureOnly =
        (code.includes("STRUKTUR") || code.includes("STRUCTURE")) &&
        !code.includes("MECH") &&
        !code.includes("MEKANIKAL");
      const isMechanicalOnly =
        (code.includes("MEKANIKAL") || code.includes("MECHANICAL")) &&
        !code.includes("STRUKTUR") &&
        !code.includes("STRUCTURE");

      const unitProgs = units.map((u: any) => {
        const sItems = u.structureItems || [];
        const mItems = u.mechanicalItems || [];

        const sItemsAtCutoff = sItems.map((item: any) => ({
          ...item,
          progressPercent: getItemProgressAtCutoff(item, "Structure", u.name, project, cutoffDate),
          qty: Number(item.qty || 1),
        }));

        const mItemsAtCutoff = mItems.map((item: any) => ({
          ...item,
          progressPercent: getItemProgressAtCutoff(item, "Mechanical", u.name, project, cutoffDate),
          qty: Number(item.qty || 1),
        }));

        const uType = isStructureOnly
          ? "STRUCTURE"
          : isMechanicalOnly
          ? "MECHANICAL"
          : (u.unitType || "BOTH");

        const uProg = calcUnitProgress(sItemsAtCutoff, mItemsAtCutoff, uType);

        return {
          actualPercent: uProg,
          weightPercent: Number(u.weightPercent || (100 / Math.max(1, units.length))),
        };
      });

      const totalUnitsProg = calcPhaseProgress(unitProgs);
      return Math.round(totalUnitsProg * 100) / 100;
    }

    return 0;
  }

  // 4. Erection Cutoff
  if (code.includes("ERECTION")) {
    const units = project?.conveyorUnits || [];
    if (units.length > 0) {
      const unitErectionProgs = units.map((u: any) => {
        const allItems = [
          ...(u.structureItems || []),
          ...(u.mechanicalItems || []),
        ];
        if (allItems.length === 0) return 0;

        const itemErectionProgs = allItems.map((item: any) =>
          getItemErectionProgressAtCutoff(item, u.name, project, cutoffDate),
        );

        return (
          itemErectionProgs.reduce((s: number, p: number) => s + p, 0) /
          allItems.length
        );
      });

      const totalProg =
        unitErectionProgs.reduce((s: number, p: number) => s + p, 0) /
        units.length;
      return Math.round(totalProg * 100) / 100;
    }
  }

  // 5. Shipment Cutoff (Based on Packages & Shipments status at cutoffDate)
  if (code.includes("SHIPMENT") || code.includes("PENGIRIMAN")) {
    const packages = project?.shipmentPackages || project?.packages || [];
    const units = project?.conveyorUnits || [];

    // Jika waktu cutoff saat ini atau di masa depan, dan phase sudah memiliki actualProgress tersimpan > 0
    if (cutoffDate.getTime() >= Date.now() && phase?.actualProgress && Number(phase.actualProgress) > 0) {
      return Number(phase.actualProgress);
    }

    if (units.length > 0 && packages.length > 0) {
      // Filter paket yang dibuat / dikirim sebelum atau pada cutoffDate
      const validPackages = packages.filter((pkg: any) => {
        const d =
          pkg.shipment?.deliveryDate ||
          pkg.shipment?.createdAt ||
          pkg.updatedAt ||
          pkg.createdAt;
        return d && new Date(d).getTime() <= cutoffDate.getTime();
      });

      if (validPackages.length === 0) return 0;

      // Buat map koli/komponen yang aktif pada cutoffDate
      const deliveredStatusMap = new Map<string, number>();

      validPackages.forEach((pkg: any) => {
        let st = (pkg.status || "").toUpperCase();
        if (pkg.shipment) {
          const shSt = (pkg.shipment.status || "").toUpperCase();
          if (shSt === "DELIVERED") st = "DELIVERED";
          else if (shSt === "IN_DELIVERY") st = "IN_DELIVERY";
          else if (shSt === "READY_TO_SHIP") st = "READY_TO_SHIP";
        }

        let score = 0;
        if (st === "DELIVERED") score = 100;
        else if (st === "IN_DELIVERY") score = 60;
        else if (st === "READY_TO_SHIP") score = 25;

        // Map tiap project_component di koli
        (pkg.project_components || []).forEach((pc: any) => {
          const mCode = (pc.markingCode || "").trim().toUpperCase();
          const pName = (pc.name || "").trim().toUpperCase();
          if (mCode) deliveredStatusMap.set(mCode, Math.max(score, deliveredStatusMap.get(mCode) || 0));
          if (pName) deliveredStatusMap.set(pName, Math.max(score, deliveredStatusMap.get(pName) || 0));
        });

        const pItemCode = (pkg.itemCode || "").trim().toUpperCase();
        const pItemName = (pkg.itemName || "").trim().toUpperCase();
        if (pItemCode) deliveredStatusMap.set(pItemCode, Math.max(score, deliveredStatusMap.get(pItemCode) || 0));
        if (pItemName) deliveredStatusMap.set(pItemName, Math.max(score, deliveredStatusMap.get(pItemName) || 0));
      });

      const unitProgs = units.map((u: any) => {
        const uMark = (u.markingCode || "").trim().toUpperCase();
        const allItems: any[] = [
          ...(u.structureItems || []),
          ...(u.mechanicalItems || []),
        ];

        if (allItems.length > 0) {
          let unitScoreSum = 0;
          allItems.forEach((it: any) => {
            const iMark = (it.markingCode || "").trim().toUpperCase();
            const iName = (it.name || "").trim().toUpperCase();
            let itScore = 0;

            if (iMark && deliveredStatusMap.has(iMark)) {
              itScore = deliveredStatusMap.get(iMark) || 0;
            } else if (iName && deliveredStatusMap.has(iName)) {
              itScore = deliveredStatusMap.get(iName) || 0;
            } else if (uMark) {
              // Cek apakah ada paket terkirim dengan prefix unit ini
              for (const [key, val] of deliveredStatusMap.entries()) {
                if (key.startsWith(uMark + "-") || key.startsWith(uMark + "/") || key === uMark) {
                  itScore = val;
                  break;
                }
              }
            }

            unitScoreSum += itScore;
          });

          return Math.round((unitScoreSum / allItems.length) * 100) / 100;
        }

        // Fallback jika unit belum memiliki rincian komponen
        if (uMark && deliveredStatusMap.has(uMark)) {
          return deliveredStatusMap.get(uMark) || 0;
        }
        return 0;
      });

      const avgProg = unitProgs.reduce((s: number, p: number) => s + p, 0) / units.length;
      return Math.min(100, Math.round(avgProg * 100) / 100);
    }

    if (phase?.actualProgress && Number(phase.actualProgress) > 0) {
      return Number(phase.actualProgress);
    }
  }

  // 6. Phase Weekly Progresses (Explicit manual weekly entry: Civil, Electrical, Commissioning, etc.)
  if (phase?.weeklyProgresses && phase.weeklyProgresses.length > 0) {
    const startDate = project?.masterplan?.startDate || project?.createdAt;
    if (startDate) {
      const diffMs = cutoffDate.getTime() - new Date(startDate).getTime();
      const cutoffWeekNum = Math.max(
        1,
        Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1,
      );

      const validEntries = phase.weeklyProgresses.filter(
        (wp: any) => wp.weekNumber <= cutoffWeekNum,
      );
      if (validEntries.length > 0) {
        const sumProg = validEntries.reduce(
          (sum: number, wp: any) => sum + Number(wp.actualPercent || 0),
          0,
        );
        return Math.min(100, Math.round(sumProg * 100) / 100);
      }
      return 0;
    }
  }

  // 6. Phase SubSteps (e.g. Civil Work, Shipment, Commissioning, dll.)
  if (phase?.subProgresses && phase.subProgresses.length > 0) {
    const validSteps = phase.subProgresses.filter((sp: any) => {
      return (
        sp.checked &&
        sp.checkedAt &&
        new Date(sp.checkedAt).getTime() <= cutoffDate.getTime()
      );
    });
    const subProgressSum = validSteps.reduce(
      (s: number, sp: any) => s + Number(sp.weightPercent || 0),
      0,
    );
    return Math.min(100, Math.round(subProgressSum * 100) / 100);
  }

  // 6. Generic Log Fallback
  if (project?.productionLogs && Array.isArray(project.productionLogs)) {
    const logs = project.productionLogs.filter((l: any) => {
      if (new Date(l.createdAt).getTime() > cutoffDate.getTime()) return false;
      const msg = l.message || "";
      return (
        msg.includes(`"${phase.name}"`) ||
        msg.includes(`"${phase.code}"`) ||
        msg.toLowerCase().includes((phase.name || "").toLowerCase())
      );
    });

    if (logs.length > 0) {
      for (let i = logs.length - 1; i >= 0; i--) {
        const match = logs[i].message.match(/menjadi\s+([\d.]+)\%/i);
        if (match && match[1]) {
          return Number(match[1]);
        }
      }
    }
  }

  // Default: If cutoffDate is >= now, return current actualProgress, else 0
  if (cutoffDate.getTime() >= Date.now()) {
    return Number(phase?.actualProgress || 0);
  }

  return 0;
}

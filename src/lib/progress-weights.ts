// ==========================================
// STRUCTURE SUB-PROGRESS WEIGHTS
// ==========================================
export const STRUCTURE_WEIGHTS = {
  cutting:   0.15,   // C/D (Cutting/Drilling): 15%
  setting:   0.35,   // Setting: 35%
  welding:   0.40,   // Welding: 40%
  finishing: 0.05,   // Finishing: 5%
  painting:  0.035,  // Painting: 3.5%
  packaging: 0.015,  // Packaging: 1.5%
} as const;

// ==========================================
// MECHANICAL SUB-PROGRESS WEIGHTS
// ==========================================
export const MECHANICAL_WEIGHTS = {
  procurement: 0.40, // Procurement: 40%
  po:          0.10, // P.O: 10%
  fabrication: 0.45, // Fabrication: 45%
  packaging:   0.05, // Packaging: 5%
} as const;

export interface ConveyorPhaseConfig {
  code: string;
  name: string;
  weight: number;
  startWeek: number;
  endWeek: number;
  orderIndex: number;
}

export const DEFAULT_CONVEYOR_PHASES: ConveyorPhaseConfig[] = [
  { code: "PROCUREMENT", name: "Procurement", weight: 12.50, startWeek: 1, endWeek: 15, orderIndex: 1 },
  { code: "ENGINEERING", name: "Engineering", weight: 2.50, startWeek: 1, endWeek: 14, orderIndex: 2 },
  { code: "FAB_STRUCT_MECH", name: "Fabrication Structure & Mechanical", weight: 35.00, startWeek: 1, endWeek: 19, orderIndex: 3 },
  { code: "CLEARING", name: "Clearing / leveling area by owner", weight: 0.00, startWeek: 2, endWeek: 6, orderIndex: 4 }, // 0% weight initially or custom
  { code: "CIVIL_WORK", name: "Civil Work", weight: 25.00, startWeek: 5, endWeek: 21, orderIndex: 5 },
  { code: "SHIPMENT", name: "Shipment to Site", weight: 2.50, startWeek: 13, endWeek: 15, orderIndex: 6 },
  { code: "ERECTION", name: "Erection", weight: 8.55, startWeek: 13, endWeek: 29, orderIndex: 7 },
  { code: "ELECTRICAL", name: "Electrical System", weight: 13.00, startWeek: 13, endWeek: 29, orderIndex: 8 },
  { code: "COMMISSIONING", name: "Commissioning", weight: 0.95, startWeek: 29, endWeek: 30, orderIndex: 9 },
];

/**
 * Menghasilkan konfigurasi tahapan default yang disesuaikan secara proporsional
 * dengan total durasi pengerjaan proyek (totalWeeks).
 */
export function getDefaultPhasesForDuration(totalWeeks: number): ConveyorPhaseConfig[] {
  const weeks = Math.max(1, Math.round(totalWeeks || 30));
  const baselineWeeks = 30;

  return DEFAULT_CONVEYOR_PHASES.map((p, idx, arr) => {
    if (weeks === baselineWeeks) {
      return { ...p };
    }

    let scaledStart =
      p.startWeek === 1
        ? 1
        : Math.max(1, Math.min(weeks, Math.round((p.startWeek / baselineWeeks) * weeks)));

    let scaledEnd =
      idx === arr.length - 1 || p.endWeek >= baselineWeeks
        ? weeks
        : Math.max(scaledStart, Math.min(weeks, Math.round((p.endWeek / baselineWeeks) * weeks)));

    if (scaledStart > scaledEnd) {
      scaledStart = scaledEnd;
    }

    return {
      ...p,
      startWeek: scaledStart,
      endWeek: scaledEnd,
    };
  });
}


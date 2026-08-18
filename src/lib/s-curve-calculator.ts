export interface SCurveDataPoint {
  weekNumber: number;
  weekLabel: string;
  planWeekly: number;
  planCumulative: number;
  actualWeekly: number;
  actualCumulative: number;
  variance: number;
  deviation: number;
}

export interface SCurveWeekHeader {
  weekNumber: number;
  monthName: string;      // e.g. "Maret 2026", "April 2026"
  weekInMonth: string;    // e.g. "I", "II", "III", "IV", "V"
  dateRange: string;      // e.g. "30-05", "06-12"
  startDate: Date;
  endDate: Date;
}

export interface SCurvePhaseInput {
  id?: string;
  code: string;
  name: string;
  weightPercent: number | string | any;
  startWeek: number;
  endWeek: number;
  orderIndex?: number;
  weeklyTargets?: Record<number, number> | Array<{ weekNumber: number; targetPercent: number }>;
}

export interface SCurveMatrixRow {
  phaseId?: string;
  code: string;
  name: string;
  weightPercent: number;
  durationWeeks: number;
  startWeek: number;
  endWeek: number;
  orderIndex: number;
  weeklyTargets: number[]; // Index 0 = Week 1, length = totalWeeks
}

export interface MasterScheduleMatrix {
  totalWeeks: number;
  startDateStr: string;
  weekHeaders: SCurveWeekHeader[];
  monthHeaderGroups: Array<{ monthName: string; weekCount: number }>;
  items: SCurveMatrixRow[];
  summary: {
    planProgressMainWeeks: number[];       // Row 1: Target rencana mingguan murni
    planProgressCumulative: number[];      // Row 2: Akumulasi rencana (Blue Line)
    progressVarianceWeeks: number[];       // Row 3: Varian/Capaian aktual mingguan murni
    actualProgressCumulative: number[];    // Row 4: Akumulasi aktual (Red Line)
    deviation: number[];                   // Row 5: Deviasi (Actual Cum - Plan Cum)
  };
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V"];

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Generates structured week headers (Month, Roman Week Index, Date Range) starting from startDate.
 */
export function generateWeekHeaders(startDateStr: string, totalWeeks: number): SCurveWeekHeader[] {
  const start = startDateStr ? new Date(startDateStr) : new Date();
  const headers: SCurveWeekHeader[] = [];

  const monthCounters: Record<string, number> = {};

  for (let w = 1; w <= totalWeeks; w++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (w - 1) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const monthName = `${INDONESIAN_MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
    
    // Count week index within this month
    monthCounters[monthName] = (monthCounters[monthName] || 0) + 1;
    const weekIdxInMonth = Math.min(monthCounters[monthName], 5);
    const weekInMonth = ROMAN_NUMERALS[weekIdxInMonth - 1] || `${weekIdxInMonth}`;

    const startDayStr = String(weekStart.getDate()).padStart(2, "0");
    const endDayStr = String(weekEnd.getDate()).padStart(2, "0");
    const dateRange = `${startDayStr}-${endDayStr}`;

    headers.push({
      weekNumber: w,
      monthName,
      weekInMonth,
      dateRange,
      startDate: weekStart,
      endDate: weekEnd,
    });
  }

  return headers;
}

/**
 * Calculates the weekly plan percentages distributed evenly across the phase duration.
 */
export function distributeWeeklyPlanProgress(
  totalWeeks: number,
  phases: SCurvePhaseInput[]
): Array<{ weekNumber: number; planWeekly: number; planCumulative: number }> {
  const matrix = calculateMasterScheduleMatrix(totalWeeks, new Date().toISOString(), phases);
  
  return matrix.weekHeaders.map((h, i) => ({
    weekNumber: h.weekNumber,
    planWeekly: matrix.summary.planProgressMainWeeks[i] || 0,
    planCumulative: matrix.summary.planProgressCumulative[i] || 0,
  }));
}

/**
 * Calculates the full Master Schedule S-Curve Matrix matching PT Jasa Laksa Utama's official spreadsheet standard.
 */
export function calculateMasterScheduleMatrix(
  totalWeeks: number,
  startDateStr: string,
  phases: SCurvePhaseInput[],
  actualWeeklyCumulativeMap?: Record<number, number>
): MasterScheduleMatrix {
  const weekHeaders = generateWeekHeaders(startDateStr, totalWeeks);

  // Group month headers for top table row
  const monthHeaderGroups: Array<{ monthName: string; weekCount: number }> = [];
  for (const header of weekHeaders) {
    const last = monthHeaderGroups[monthHeaderGroups.length - 1];
    if (last && last.monthName === header.monthName) {
      last.weekCount += 1;
    } else {
      monthHeaderGroups.push({ monthName: header.monthName, weekCount: 1 });
    }
  }

  // Determine max configured week across phases to handle custom totalWeeks scaling (e.g. 20 weeks vs 30 weeks template)
  const maxPhaseWeek = Math.max(totalWeeks, ...phases.map((p) => Number(p.endWeek || totalWeeks)));

  // Build matrix rows for each work item / phase
  const items: SCurveMatrixRow[] = phases.map((phase, idx) => {
    const weight = typeof phase.weightPercent === "object"
      ? Number(phase.weightPercent?.toString() || 0)
      : Number(phase.weightPercent || 0);

    let rawStartW = Math.max(1, Number(phase.startWeek || 1));
    let rawEndW = Math.max(rawStartW, Number(phase.endWeek || maxPhaseWeek));

    // FAB_STRUCT_MECH starts from week 1 by default
    if (phase.code === "FAB_STRUCT_MECH" && rawStartW === 2) {
      rawStartW = 1;
      rawEndW = Math.max(1, rawEndW - 1);
    }

    let startW = rawStartW;
    let endW = rawEndW;

    // Scale startWeek & endWeek if configured phase weeks exceed totalWeeks
    if (maxPhaseWeek > totalWeeks) {
      const ratio = totalWeeks / maxPhaseWeek;
      startW = Math.max(1, Math.min(totalWeeks, Math.round(rawStartW * ratio)));
      endW = Math.max(startW, Math.min(totalWeeks, Math.round(rawEndW * ratio)));
    } else {
      startW = Math.max(1, Math.min(totalWeeks, startW));
      endW = Math.max(startW, Math.min(totalWeeks, endW));
    }

    const duration = Math.max(1, endW - startW + 1);
    const weeklyTargets = new Array(totalWeeks).fill(0);

    // Check if explicit custom targets exist
    let hasCustomTargets = false;
    if (phase.weeklyTargets) {
      if (Array.isArray(phase.weeklyTargets) && phase.weeklyTargets.length > 0) {
        for (const wt of phase.weeklyTargets) {
          if (wt.weekNumber >= 1 && wt.weekNumber <= totalWeeks) {
            weeklyTargets[wt.weekNumber - 1] = Number(wt.targetPercent || 0);
            hasCustomTargets = true;
          }
        }
      } else if (typeof phase.weeklyTargets === "object" && Object.keys(phase.weeklyTargets).length > 0) {
        for (const [wStr, val] of Object.entries(phase.weeklyTargets)) {
          const w = Number(wStr);
          if (w >= 1 && w <= totalWeeks) {
            weeklyTargets[w - 1] = Number(val || 0);
            hasCustomTargets = true;
          }
        }
      }
    }

    // Fallback: If no custom target provided, spread evenly across active duration
    if (!hasCustomTargets && weight > 0 && duration > 0) {
      const share = Math.round((weight / duration) * 100) / 100;
      let sumSpread = 0;
      for (let w = startW; w <= endW; w++) {
        const isLastWeek = w === endW;
        const val = isLastWeek ? Math.round((weight - sumSpread) * 100) / 100 : share;
        weeklyTargets[w - 1] = Math.max(0, val);
        sumSpread += val;
      }
    }

    return {
      phaseId: phase.id,
      code: phase.code,
      name: phase.name,
      weightPercent: weight,
      durationWeeks: duration,
      startWeek: startW,
      endWeek: endW,
      orderIndex: phase.orderIndex ?? (idx + 1),
      weeklyTargets,
    };
  });

  // Calculate Summary Rows
  const planProgressMainWeeks = new Array(totalWeeks).fill(0);
  const planProgressCumulative = new Array(totalWeeks).fill(0);
  const actualProgressCumulative = new Array(totalWeeks).fill(0);
  const progressVarianceWeeks = new Array(totalWeeks).fill(0);
  const deviation = new Array(totalWeeks).fill(0);

  // 1. PLAN PROGRESS MAIN WEEKS (Sum of item targets for week w)
  for (let w = 0; w < totalWeeks; w++) {
    let weekSum = 0;
    for (const item of items) {
      weekSum += item.weeklyTargets[w] || 0;
    }
    planProgressMainWeeks[w] = Math.round(weekSum * 100) / 100;
  }

  // 2. PLAN PROGRESS CUMULATIVE / WEEK
  let runningPlanCum = 0;
  for (let w = 0; w < totalWeeks; w++) {
    runningPlanCum += planProgressMainWeeks[w];
    // Final week cumulative plan progress must equal 100.00% if total phase weights sum to 100
    const roundedCum = Math.round(runningPlanCum * 100) / 100;
    if (w === totalWeeks - 1 && roundedCum >= 99.0) {
      planProgressCumulative[w] = 100.00;
    } else {
      planProgressCumulative[w] = Math.min(100, roundedCum);
    }
  }

  // 3. ACTUAL PROGRESS CUMULATIVE & VARIANCE & DEVIATION
  let prevActualCum = 0;
  for (let w = 0; w < totalWeeks; w++) {
    const weekNo = w + 1;
    const actualCum = actualWeeklyCumulativeMap && actualWeeklyCumulativeMap[weekNo] !== undefined
      ? Number(actualWeeklyCumulativeMap[weekNo] || 0)
      : 0;

    actualProgressCumulative[w] = Math.round(actualCum * 100) / 100;
    
    // Variance for week w = actualCum - prevActualCum
    const weekVar = w === 0 ? actualProgressCumulative[w] : Math.max(0, actualProgressCumulative[w] - prevActualCum);
    progressVarianceWeeks[w] = Math.round(weekVar * 100) / 100;
    if (actualProgressCumulative[w] > 0) {
      prevActualCum = actualProgressCumulative[w];
    }

    // Deviation for week w = actualProgressCumulative - planProgressCumulative
    deviation[w] = Math.round((actualProgressCumulative[w] - planProgressCumulative[w]) * 100) / 100;
  }

  return {
    totalWeeks,
    startDateStr,
    weekHeaders,
    monthHeaderGroups,
    items,
    summary: {
      planProgressMainWeeks,
      planProgressCumulative,
      progressVarianceWeeks,
      actualProgressCumulative,
      deviation,
    },
  };
}

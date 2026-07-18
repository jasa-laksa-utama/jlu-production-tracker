export interface SCurveDataPoint {
  weekNumber: number;
  weekLabel: string;
  planWeekly: number;
  planCumulative: number;
  actualWeekly: number;
  actualCumulative: number;
  variance: number;
}

/**
 * Calculates the weekly plan percentages distributed evenly across the phase duration.
 * planWeekly = Sum of (Phase Weight / Phase Duration) for all phases active during that week.
 */
export function distributeWeeklyPlanProgress(
  totalWeeks: number,
  phases: Array<{
    code: string;
    weightPercent: number | string | any;
    startWeek: number;
    endWeek: number;
  }>
): Array<{ weekNumber: number; planWeekly: number; planCumulative: number }> {
  const weeklyPlans = Array.from({ length: totalWeeks }, (_, i) => ({
    weekNumber: i + 1,
    planWeekly: 0,
    planCumulative: 0,
  }));

  for (const phase of phases) {
    const weight = typeof phase.weightPercent === "object" 
      ? Number(phase.weightPercent?.toString() || 0) 
      : Number(phase.weightPercent || 0);
    const start = Math.max(1, Number(phase.startWeek || 1));
    const end = Math.min(totalWeeks, Number(phase.endWeek || totalWeeks));
    const duration = end - start + 1;

    if (duration > 0 && weight > 0) {
      const weeklyShare = weight / duration;
      for (let w = start; w <= end; w++) {
        weeklyPlans[w - 1].planWeekly += weeklyShare;
      }
    }
  }

  // Calculate cumulative plans
  let cumulative = 0;
  for (let w = 0; w < totalWeeks; w++) {
    cumulative += weeklyPlans[w - 1] ? weeklyPlans[w - 1].planWeekly : weeklyPlans[w].planWeekly;
    weeklyPlans[w].planCumulative = Math.min(100, cumulative);
  }

  // Round values
  return weeklyPlans.map((wp) => ({
    weekNumber: wp.weekNumber,
    planWeekly: Math.round(wp.planWeekly * 100) / 100,
    planCumulative: Math.round(wp.planCumulative * 100) / 100,
  }));
}

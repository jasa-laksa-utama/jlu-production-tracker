/**
 * Helper utility to calculate phase progress at a specific historical cutoff date.
 */
export function getPhaseProgressAtCutoff(
  phase: any,
  project: any,
  cutoffDate: Date,
): number {
  const currentActual = Number(phase?.actualProgress || 0);

  // If cutoffDate is >= current time (e.g. current week), return currentActual
  if (cutoffDate.getTime() >= Date.now()) {
    return currentActual;
  }

  let loggedProgress: number | null = null;

  // 1. Check production logs on or before cutoffDate
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
          loggedProgress = Number(match[1]);
          break;
        }
      }
    }
  }

  // 2. Check SubSteps checkedAt <= cutoffDate
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
    if (loggedProgress === null || subProgressSum > loggedProgress) {
      loggedProgress = subProgressSum;
    }
  }

  const code = (phase?.code || "").toUpperCase();

  if (code.includes("PROCURE")) {
    const spbBeforeCutoff = (project?.spb || []).filter((s: any) => {
      const date = s.approvedByPmAt || s.approvedByPpicAt || s.createdAt;
      return date && new Date(date).getTime() <= cutoffDate.getTime();
    });
    if (spbBeforeCutoff.length > 0) {
      const approvedCount = spbBeforeCutoff.filter(
        (s: any) => s.status === "APPROVED_PM" || s.status === "APPROVED_PPIC",
      ).length;
      const procProg = approvedCount === spbBeforeCutoff.length ? 100 : 50;
      return Math.min(procProg, currentActual);
    } else {
      return 0;
    }
  }

  if (code.includes("ENG")) {
    const docsBeforeCutoff = (project?.documents || []).filter((d: any) => {
      return d.createdAt && new Date(d.createdAt).getTime() <= cutoffDate.getTime();
    });
    const boqsBeforeCutoff = (project?.boqs || []).filter((b: any) => {
      const date = b.boqApprovedByPmAt || b.boqApprovedByPpicAt || b.createdAt;
      return date && new Date(date).getTime() <= cutoffDate.getTime();
    });

    if (docsBeforeCutoff.length > 0 || boqsBeforeCutoff.length > 0) {
      const isApproved = boqsBeforeCutoff.some((b: any) => b.boqStatus === "APPROVED");
      const engProg = isApproved ? 100 : 50;
      return Math.min(engProg, currentActual);
    } else {
      return 0;
    }
  }

  if (code.includes("FAB")) {
    if (loggedProgress !== null) {
      return Math.min(loggedProgress, currentActual);
    }
    const fabLogs = (project?.productionLogs || []).filter((l: any) => {
      const t = new Date(l.createdAt).getTime();
      return t <= cutoffDate.getTime() && l.message.includes("Structure");
    });
    if (fabLogs.length > 0) {
      return currentActual;
    } else {
      return 0;
    }
  }

  if (loggedProgress !== null) {
    return Math.min(loggedProgress, currentActual);
  }

  return 0;
}

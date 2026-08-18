export interface DivisionKPIMetrics {
  engineering: {
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    durationDays: number | null;
    label: string;
  };
  ppic: {
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    durationDays: number | null;
    label: string;
  };
  production: {
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    durationDays: number | null;
    label: string;
  };
  qc: {
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    durationDays: number | null;
    label: string;
  };
}

export function calcProjectDivisionKPIs(project: {
  createdAt?: Date | string | null;
  dealAt?: Date | string | null;
  boqApprovedAt?: Date | string | null;
  spbCompletedAt?: Date | string | null;
  poCompletedAt?: Date | string | null;
  productionCompletedAt?: Date | string | null;
  qcCompletedAt?: Date | string | null;
  boqs?: Array<{ boqStatus: string }>;
  masterplan?: any;
}): DivisionKPIMetrics {
  const dealTime = project.dealAt
    ? new Date(project.dealAt).getTime()
    : project.createdAt
    ? new Date(project.createdAt).getTime()
    : Date.now();

  const boqApprovedTime = project.boqApprovedAt
    ? new Date(project.boqApprovedAt).getTime()
    : null;

  const ppicCompletedTime = project.poCompletedAt
    ? new Date(project.poCompletedAt).getTime()
    : project.spbCompletedAt
    ? new Date(project.spbCompletedAt).getTime()
    : null;

  const productionCompletedTime = project.productionCompletedAt
    ? new Date(project.productionCompletedAt).getTime()
    : null;

  const qcCompletedTime = project.qcCompletedAt
    ? new Date(project.qcCompletedAt).getTime()
    : null;

  const now = Date.now();

  const getDaysDiff = (startMs: number, endMs: number) => {
    const diffHours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
    if (diffHours < 24) {
      return Number((diffHours / 24).toFixed(1));
    }
    return Math.round(diffHours / 24);
  };

  // 1. Engineering KPI
  const hasBoqApproved =
    boqApprovedTime !== null ||
    (project.boqs && project.boqs.some((b) => b.boqStatus === "APPROVED"));
  const engStatus = hasBoqApproved ? "COMPLETED" : "IN_PROGRESS";
  const engEndTime = boqApprovedTime || now;
  const engDays = getDaysDiff(dealTime, engEndTime);

  // 2. PPIC / Procurement KPI
  const ppicStartTime = boqApprovedTime || dealTime;
  const ppicStatus = ppicCompletedTime
    ? "COMPLETED"
    : hasBoqApproved
    ? "IN_PROGRESS"
    : "PENDING";
  const ppicEndTime =
    ppicCompletedTime || (ppicStatus === "IN_PROGRESS" ? now : ppicStartTime);
  const ppicDays =
    ppicStatus !== "PENDING" ? getDaysDiff(ppicStartTime, ppicEndTime) : null;

  // 3. Production KPI
  const prodStartTime = ppicCompletedTime || boqApprovedTime || dealTime;
  const prodStatus = productionCompletedTime
    ? "COMPLETED"
    : project.masterplan
    ? "IN_PROGRESS"
    : "PENDING";
  const prodEndTime =
    productionCompletedTime ||
    (prodStatus === "IN_PROGRESS" ? now : prodStartTime);
  const prodDays =
    prodStatus !== "PENDING" ? getDaysDiff(prodStartTime, prodEndTime) : null;

  // 4. QC KPI
  const qcStartTime = productionCompletedTime || prodStartTime;
  const qcStatus = qcCompletedTime
    ? "COMPLETED"
    : productionCompletedTime
    ? "IN_PROGRESS"
    : "PENDING";
  const qcEndTime =
    qcCompletedTime || (qcStatus === "IN_PROGRESS" ? now : qcStartTime);
  const qcDays =
    qcStatus !== "PENDING" ? getDaysDiff(qcStartTime, qcEndTime) : null;

  return {
    engineering: {
      status: engStatus,
      durationDays: engDays,
      label:
        engStatus === "COMPLETED"
          ? `${engDays} Hari`
          : `${engDays} Hari (Jalan)`,
    },
    ppic: {
      status: ppicStatus,
      durationDays: ppicDays,
      label:
        ppicStatus === "COMPLETED"
          ? `${ppicDays} Hari`
          : ppicStatus === "IN_PROGRESS"
          ? `${ppicDays} Hari (Jalan)`
          : "Pending",
    },
    production: {
      status: prodStatus,
      durationDays: prodDays,
      label:
        prodStatus === "COMPLETED"
          ? `${prodDays} Hari`
          : prodStatus === "IN_PROGRESS"
          ? `${prodDays} Hari (Jalan)`
          : "Pending",
    },
    qc: {
      status: qcStatus,
      durationDays: qcDays,
      label:
        qcStatus === "COMPLETED"
          ? `${qcDays} Hari`
          : qcStatus === "IN_PROGRESS"
          ? `${qcDays} Hari (Jalan)`
          : "Pending",
    },
  };
}

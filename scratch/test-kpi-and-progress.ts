import assert from "node:assert";
import { test, describe } from "node:test";
import { calcProjectDivisionKPIs } from "../src/lib/kpi-calculator";
import {
  calcStructureItemProgress,
  calcMechanicalItemProgress,
  calcUnitProgress,
} from "../src/lib/progress-calculator";

describe("TDD Suite — Division KPI Calculator", () => {
  test("1. Project Baru Deal: Eng IN_PROGRESS, PPIC/Prod/QC PENDING", () => {
    const dealDate = new Date("2026-07-01T00:00:00Z");
    const kpi = calcProjectDivisionKPIs({
      createdAt: dealDate,
      dealAt: dealDate,
    });

    assert.strictEqual(kpi.engineering.status, "IN_PROGRESS");
    assert.strictEqual(kpi.ppic.status, "PENDING");
    assert.strictEqual(kpi.production.status, "PENDING");
    assert.strictEqual(kpi.qc.status, "PENDING");
  });

  test("2. BoQ Disetujui (3 Hari): Eng COMPLETED, PPIC IN_PROGRESS", () => {
    const dealDate = new Date("2026-07-01T00:00:00Z");
    const boqApprovedDate = new Date("2026-07-04T00:00:00Z"); // +3 hari

    const kpi = calcProjectDivisionKPIs({
      dealAt: dealDate,
      boqApprovedAt: boqApprovedDate,
    });

    assert.strictEqual(kpi.engineering.status, "COMPLETED");
    assert.strictEqual(kpi.engineering.durationDays, 3);
    assert.strictEqual(kpi.engineering.label, "3 Hari");
    assert.strictEqual(kpi.ppic.status, "IN_PROGRESS");
  });

  test("3. SPB & PO Selesai (2 Hari): PPIC COMPLETED, Prod IN_PROGRESS", () => {
    const dealDate = new Date("2026-07-01T00:00:00Z");
    const boqApprovedDate = new Date("2026-07-04T00:00:00Z");
    const poCompletedDate = new Date("2026-07-06T00:00:00Z"); // +2 hari setelah BoQ

    const kpi = calcProjectDivisionKPIs({
      dealAt: dealDate,
      boqApprovedAt: boqApprovedDate,
      poCompletedAt: poCompletedDate,
      masterplan: { id: "mp-1" },
    });

    assert.strictEqual(kpi.ppic.status, "COMPLETED");
    assert.strictEqual(kpi.ppic.durationDays, 2);
    assert.strictEqual(kpi.ppic.label, "2 Hari");
    assert.strictEqual(kpi.production.status, "IN_PROGRESS");
  });

  test("4. Produksi Selesai (14 Hari): Prod COMPLETED, QC IN_PROGRESS", () => {
    const dealDate = new Date("2026-07-01T00:00:00Z");
    const boqApprovedDate = new Date("2026-07-04T00:00:00Z");
    const poCompletedDate = new Date("2026-07-06T00:00:00Z");
    const prodCompletedDate = new Date("2026-07-20T00:00:00Z"); // +14 hari setelah PO

    const kpi = calcProjectDivisionKPIs({
      dealAt: dealDate,
      boqApprovedAt: boqApprovedDate,
      poCompletedAt: poCompletedDate,
      productionCompletedAt: prodCompletedDate,
    });

    assert.strictEqual(kpi.production.status, "COMPLETED");
    assert.strictEqual(kpi.production.durationDays, 14);
    assert.strictEqual(kpi.production.label, "14 Hari");
    assert.strictEqual(kpi.qc.status, "IN_PROGRESS");
  });
});

describe("TDD Suite — Progress Calculator Weights & Auto-Sync", () => {
  test("5. Mechanical Item Weights: Procurement (40%) + PO (10%) = 50%", () => {
    const progress = calcMechanicalItemProgress({
      qty: 2,
      procurementQty: 2, // 40%
      poQty: 2,          // 10%
      fabricationQty: 0,
      packagingQty: 0,
    });

    assert.strictEqual(progress, 50);
  });

  test("6. Structure Item Weights: Cutting (15%) + Setting (35%) + Welding (40%) = 90%", () => {
    const progress = calcStructureItemProgress({
      qty: 1,
      cuttingQty: 1, // 15%
      settingQty: 1, // 35%
      weldingQty: 1, // 40%
      finishingQty: 0,
      paintingQty: 0,
      packagingQty: 0,
    });

    assert.strictEqual(progress, 90);
  });
});

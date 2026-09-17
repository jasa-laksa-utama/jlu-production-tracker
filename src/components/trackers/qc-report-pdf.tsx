import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  // Page Styles
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#111",
    backgroundColor: "#fff",
  },
  coverPage: {
    padding: 36,
    fontFamily: "Helvetica",
    backgroundColor: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    height: "100%",
  },
  coverBorderOuter: {
    borderWidth: 1.5,
    borderColor: "#1e293b",
    borderStyle: "solid",
    padding: 8,
    width: "100%",
    height: "100%",
  },
  coverBorderInner: {
    borderWidth: 0.8,
    borderColor: "#475569",
    borderStyle: "solid",
    padding: 24,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverLogoText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: "#0f172a",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  coverCompanySub: {
    fontSize: 8,
    color: "#64748b",
    letterSpacing: 0.8,
    marginTop: 2,
    textAlign: "center",
  },
  coverCustomerBlock: {
    alignItems: "center",
    marginVertical: 8,
  },
  coverCustomerLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  coverCustomerCompany: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    letterSpacing: 0.5,
    marginTop: 3,
    textAlign: "center",
  },
  coverCustomerName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    marginTop: 2,
    textAlign: "center",
  },
  coverImageBox: {
    width: 240,
    height: 140,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 14,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  coverTitleBlock: {
    alignItems: "center",
    marginVertical: 10,
  },
  coverMainTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: "#0f172a",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  coverSubtitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#334155",
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: "center",
  },
  coverMetaBlock: {
    alignItems: "center",
    marginTop: 15,
  },
  coverMetaText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    lineHeight: 1.4,
  },
  coverDateText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    marginTop: 10,
    letterSpacing: 1,
  },

  // Document Page Header
  docHeaderContainer: {
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  docTitleBanner: {
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingVertical: 5,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  docTitleText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: "#000",
    textAlign: "center",
  },
  metaGrid: {
    flexDirection: "row",
    padding: 6,
    fontSize: 7.5,
  },
  metaCol: {
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2.5,
  },
  metaLabel: {
    width: 80,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
  },
  metaColon: {
    width: 8,
    fontFamily: "Helvetica-Bold",
  },
  metaValue: {
    flex: 1,
    color: "#000",
  },

  // Table Styles
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    minHeight: 16,
    alignItems: "center",
  },
  tableRowAlternate: {
    backgroundColor: "#f8fafc",
  },
  thCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    padding: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.8,
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  tdCell: {
    borderRightWidth: 0.5,
    borderRightColor: "#cbd5e1",
    padding: 3,
    fontSize: 6.8,
    justifyContent: "center",
  },
  tdText: {
    fontSize: 6.8,
  },
  tdTextBold: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
  },
  tdTextCenter: {
    fontSize: 6.8,
    textAlign: "center",
  },
  badgePass: {
    color: "#047857",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    textAlign: "center",
  },
  badgeFail: {
    color: "#b91c1c",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    textAlign: "center",
  },
  badgeInProgress: {
    color: "#d97706",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    textAlign: "center",
  },
  badgePending: {
    color: "#64748b",
    fontSize: 6.5,
    textAlign: "center",
  },

  // Inspection Result & Signatures
  resultContainer: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 6,
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  resultLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  checkboxGroup: {
    flexDirection: "row",
    gap: 15,
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  checkboxBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxCheck: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
  },

  // Signature Block
  signTable: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 6,
  },
  signHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  signHeaderCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    padding: 3.5,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    textAlign: "center",
  },
  signBodyRow: {
    flexDirection: "row",
    height: 48,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
  },
  signBodyCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 4,
  },
  signFooterRow: {
    flexDirection: "row",
  },
  signFooterCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: "#000",
    padding: 3,
    fontSize: 6.8,
  },

  // Photo Section
  photoSectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#0f172a",
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoCard: {
    width: "48%",
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  photoImage: {
    width: "100%",
    height: 120,
    objectFit: "cover",
  },
  photoCaptionBox: {
    padding: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  photoCaptionText: {
    fontSize: 6.8,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
  },
  photoMetaText: {
    fontSize: 6,
    color: "#64748b",
    marginTop: 1,
  },

  // Footer / Page numbers
  pageFooter: {
    position: "absolute",
    bottom: 15,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
  },
});

/**
 * Helper function to calculate precise QC status of a component:
 * - "Belum QC" if 0 stages checked
 * - "Revisi (Stage Name)" if any stage is FAIL
 * - "Proses QC" if partial stages are PASS without failure
 * - "ACCEPTED" if ALL required stages are PASS
 */
export function getItemQCStatus(
  item: any,
  itemType: "STRUCTURE" | "MECHANICAL",
  checkpoints: any[],
): {
  label: string;
  status: "ACCEPTED" | "REVISION" | "IN_PROGRESS" | "NOT_STARTED";
  passCount: number;
  totalStages: number;
  failedStageName?: string;
} {
  if (itemType === "STRUCTURE") {
    const stages = [
      "CUTTING",
      "SETTING",
      "WELDING",
      "FINISHING",
      "PAINTING",
      "PACKAGING",
    ];
    const stageLabels: Record<string, string> = {
      CUTTING: "Cutting",
      SETTING: "Setting",
      WELDING: "Welding",
      FINISHING: "Finishing",
      PAINTING: "Painting",
      PACKAGING: "Packaging",
    };
    let pass = 0;
    let failedStage = "";

    for (const stg of stages) {
      const cp = checkpoints.find(
        (c: any) => c.itemId === item.id && c.stage === stg,
      );
      if (cp?.status === "FAIL") {
        failedStage = stageLabels[stg] || stg;
        break;
      }
      if (cp?.status === "PASS") {
        pass++;
      }
    }

    if (failedStage) {
      return {
        label: `Revisi ${failedStage}`,
        status: "REVISION",
        passCount: pass,
        totalStages: 6,
        failedStageName: failedStage,
      };
    }

    if (pass === 0) {
      return {
        label: "Belum QC",
        status: "NOT_STARTED",
        passCount: 0,
        totalStages: 6,
      };
    }

    if (pass === 6) {
      return {
        label: "ACCEPTED",
        status: "ACCEPTED",
        passCount: 6,
        totalStages: 6,
      };
    }

    return {
      label: "Proses QC",
      status: "IN_PROGRESS",
      passCount: pass,
      totalStages: 6,
    };
  } else {
    // MECHANICAL
    const stages = ["PROCUREMENT", "PENERIMAAN_QC", "ASSEMBLY", "PACKAGING"];
    const stageLabels: Record<string, string> = {
      PROCUREMENT: "Procurement",
      PENERIMAAN_QC: "Penerimaan QC",
      ASSEMBLY: "Assembly",
      PACKAGING: "Packaging",
    };
    let pass = 0;
    let failedStage = "";

    for (const stg of stages) {
      const cp = checkpoints.find(
        (c: any) =>
          c.itemId === item.id &&
          (c.stage === stg ||
            (stg === "PENERIMAAN_QC" &&
              (c.stage === "PO" || c.stage === "RECEIPT")) ||
            (stg === "ASSEMBLY" && c.stage === "FABRICATION")),
      );
      if (cp?.status === "FAIL") {
        failedStage = stageLabels[stg] || stg;
        break;
      }
      if (cp?.status === "PASS") {
        pass++;
      }
    }

    if (failedStage) {
      return {
        label: `Revisi ${failedStage}`,
        status: "REVISION",
        passCount: pass,
        totalStages: 4,
        failedStageName: failedStage,
      };
    }

    if (pass === 0) {
      return {
        label: "Belum QC",
        status: "NOT_STARTED",
        passCount: 0,
        totalStages: 4,
      };
    }

    if (pass >= 4) {
      return {
        label: "ACCEPTED",
        status: "ACCEPTED",
        passCount: 4,
        totalStages: 4,
      };
    }

    return {
      label: "Proses QC",
      status: "IN_PROGRESS",
      passCount: pass,
      totalStages: 4,
    };
  }
}

export interface QCReportData {
  project: any;
  units: any[];
  targetComponent?: any;
  reportLevel?: "PROJECT" | "UNIT" | "COMPONENT";
  progressPhotos: any[];
  ncrs: any[];
  reportNumber: string;
  inspectionDate?: string;
  endFabricationDate?: string;
  deliveryTo?: string;
  specification?: {
    length?: string;
    width?: string;
    height?: string;
    material?: string;
    tonnage?: string;
  };
  signatories?: {
    qcInspector?: string;
    productionHead?: string;
    projectManager?: string;
  };
  notes?: string[];
  isAccepted?: boolean;
  coverImageUrl?: string;
}

export function QCReportPDFDocument({ data }: { data: QCReportData }) {
  const {
    project,
    units = [],
    targetComponent,
    reportLevel = "UNIT",
    progressPhotos = [],
    ncrs = [],
    reportNumber = "JLU/QC/REPORT/01/26",
    inspectionDate = new Date().toLocaleDateString("id-ID"),
    endFabricationDate = new Date().toLocaleDateString("id-ID"),
    deliveryTo = "PT. JASA LAKSA UTAMA",
    specification = {},
    signatories = {
      qcInspector: "QC Inspector PT. JLU",
      productionHead: "Kepala Produksi PT. JLU",
      projectManager: "Project Manager PT. JLU",
    },
    notes = ["Dimensi & kualitas pengelasan telah diperiksa sesuai standar."],
    coverImageUrl,
  } = data;

  const companyName =
    project?.customer?.company || project?.customer?.companyName || "";
  const personName =
    project?.customer?.name || project?.customer?.picName || "";
  const clientName = companyName
    ? `${companyName}${personName && personName !== companyName ? ` (${personName})` : ""}`
    : personName || "PT. TAMA MULIA RESOURCES";
  const poNumber =
    project?.lead?.poNumber ||
    project?.poNumber ||
    project?.projectNumber ||
    "-";

  // Pick cover photo: only if explicitly provided in coverImageUrl
  const firstPhoto = coverImageUrl || null;

  // Month & Year string
  const now = new Date();
  const monthNames = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];
  const monthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  // Automatically calculate if report has any revision/failed items
  let hasAnyRevision = false;
  let allItemsCount = 0;
  let allAcceptedCount = 0;

  units.forEach((u) => {
    (u.structureItems || []).forEach((item: any) => {
      allItemsCount++;
      const st = getItemQCStatus(item, "STRUCTURE", u.qcCheckpoints || []);
      if (st.status === "REVISION") hasAnyRevision = true;
      if (st.status === "ACCEPTED") allAcceptedCount++;
    });
    (u.mechanicalItems || []).forEach((item: any) => {
      allItemsCount++;
      const st = getItemQCStatus(item, "MECHANICAL", u.qcCheckpoints || []);
      if (st.status === "REVISION") hasAnyRevision = true;
      if (st.status === "ACCEPTED") allAcceptedCount++;
    });
  });

  // Calculate final acceptance: user preference or auto-calculated
  // Rejected ONLY if there is an active defect/revision (hasAnyRevision === true)
  const isFinalAccepted =
    data.isAccepted !== undefined ? data.isAccepted : !hasAnyRevision;

  // Fallback targetComponent if in COMPONENT mode but targetComponent not populated yet
  const effectiveTargetComponent =
    targetComponent ||
    (reportLevel === "COMPONENT" && units.length > 0
      ? (units[0].structureItems || [])[0] ||
        (units[0].mechanicalItems || [])[0]
      : null);

  const totalCompCount = units.reduce(
    (sum, u) =>
      sum +
      (u.structureItems?.length || 0) +
      (u.mechanicalItems?.length || 0),
    0,
  );

  // Title string based on level
  const docSubtitle =
    reportLevel === "COMPONENT"
      ? totalCompCount === 1 && effectiveTargetComponent
        ? `${effectiveTargetComponent.name.toUpperCase()} (Qty: ${effectiveTargetComponent.qty || 1} ${effectiveTargetComponent.unit || "pcs"})`
        : `INSPEKSI ${totalCompCount} KOMPONEN (${units.map((u) => u.name).join(", ")})`
      : units.length === 1
        ? `UNIT ${units[0].name.toUpperCase()} (${units[0].volume || 1} ${units[0].satuan || "Unit"})`
        : `${units.length} UNIT CONVEYOR (${units.map((u) => u.name).join(", ")})`;

  return (
    <Document
      title={`QC_Report_${project?.projectName || "Project"}_${reportNumber}`}
    >
      {/* ======================================================== */}
      {/* 1. COVER PAGE                                            */}
      {/* ======================================================== */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverBorderOuter}>
          <View style={styles.coverBorderInner}>
            {/* Top Logo & Header */}
            <View style={{ alignItems: "center" }}>
              <Text style={styles.coverLogoText}>PT. JASA LAKSA UTAMA</Text>
              <Text style={styles.coverCompanySub}>
                ENGINEERING, FABRICATION & INDUSTRIAL CONVEYOR SYSTEMS
              </Text>
            </View>

            {/* Customer & Company Info */}
            <View style={styles.coverCustomerBlock}>
              <Text style={styles.coverCustomerLabel}>CUSTOMER:</Text>
              {companyName ? (
                <>
                  <Text style={styles.coverCustomerCompany}>
                    {companyName.toUpperCase()}
                  </Text>
                  {personName && personName !== companyName && (
                    <Text style={styles.coverCustomerName}>{personName}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.coverCustomerCompany}>
                  {(personName || "PT. TAMA MULIA RESOURCES").toUpperCase()}
                </Text>
              )}
            </View>

            {/* Main Inspection Photo */}
            <View style={styles.coverImageBox}>
              {firstPhoto ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={firstPhoto} style={styles.coverImage} />
              ) : (
                <Text style={{ fontSize: 8, color: "#94a3b8" }}>
                  Foto Dokumentasi Fabrikasi & QC
                </Text>
              )}
            </View>

            {/* Document Titles */}
            <View style={styles.coverTitleBlock}>
              <Text style={styles.coverMainTitle}>
                INSPECTION, TEST & PROCEDURE
              </Text>
              <Text style={styles.coverSubtitle}>
                {docSubtitle}
                {specification.length
                  ? ` (${specification.length}x${specification.width || ""}x${specification.height || ""})`
                  : ""}
              </Text>
            </View>

            {/* Metadata Footer */}
            <View style={styles.coverMetaBlock}>
              <Text style={styles.coverMetaText}>No. PO : {poNumber}</Text>
              <Text style={styles.coverMetaText}>No. QC : {reportNumber}</Text>
              <Text style={styles.coverDateText}>{monthYear}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ======================================================== */}
      {/* 2. INSPECTION CHECKPOINTS & DIMENSION MATRIX PAGES        */}
      {/* ======================================================== */}
      {units.map((unit, uIdx) => {
        const structureItems = unit.structureItems || [];
        const mechanicalItems = unit.mechanicalItems || [];
        const checkpoints = unit.qcCheckpoints || [];

        return (
          <Page key={unit.id || uIdx} size="A4" style={styles.page}>
            {/* Header Document Box */}
            <View style={styles.docHeaderContainer}>
              <View style={styles.docTitleBanner}>
                <Text style={styles.docTitleText}>
                  QUALITY CONTROL & DIMENSION INSPECTION REPORT
                </Text>
              </View>
              <View style={styles.metaGrid}>
                {/* Left Meta Column */}
                <View style={styles.metaCol}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>CLIENT</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{clientName}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>PART / UNIT</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>
                      {reportLevel === "COMPONENT" && effectiveTargetComponent
                        ? effectiveTargetComponent.name
                        : unit.name}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>POSITION</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>
                      {reportLevel === "COMPONENT" && effectiveTargetComponent
                        ? `UNIT: ${effectiveTargetComponent.unitName || unit.name}`
                        : project?.projectName || "MAIN CONVEYOR"}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>REPORT No.</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{reportNumber}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>SPECIFICATION</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>
                      P: {specification.length || "-"} | L:{" "}
                      {specification.width || "-"} | T:{" "}
                      {specification.height || "-"}
                    </Text>
                  </View>
                </View>

                {/* Right Meta Column */}
                <View style={styles.metaCol}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>END FABRICATION</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{endFabricationDate}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>DELIVERY</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{deliveryTo}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>INSPECTION DATE</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{inspectionDate}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>NO. PO</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{poNumber}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>TOTAL ITEMS</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>
                      {structureItems.length + mechanicalItems.length} Komponen
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Structure Items Inspection Table */}
            {structureItems.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    fontFamily: "Helvetica-Bold",
                    fontSize: 7.5,
                    marginBottom: 3,
                    color: "#1e293b",
                  }}
                >
                  A. PEMERIKSAAN KOMPONEN STRUKTUR (FABRIKASI)
                </Text>
                <View style={styles.table}>
                  {/* Table Head */}
                  <View style={styles.tableHeaderRow}>
                    <View style={[styles.thCell, { width: 22 }]}>
                      <Text>No.</Text>
                    </View>
                    <View style={[styles.thCell, { flex: 2 }]}>
                      <Text>Nama Komponen</Text>
                    </View>
                    <View style={[styles.thCell, { width: 30 }]}>
                      <Text>Qty</Text>
                    </View>
                    <View style={[styles.thCell, { width: 42 }]}>
                      <Text>Cutting</Text>
                    </View>
                    <View style={[styles.thCell, { width: 42 }]}>
                      <Text>Setting</Text>
                    </View>
                    <View style={[styles.thCell, { width: 42 }]}>
                      <Text>Welding</Text>
                    </View>
                    <View style={[styles.thCell, { width: 42 }]}>
                      <Text>Finishing</Text>
                    </View>
                    <View style={[styles.thCell, { width: 42 }]}>
                      <Text>Painting</Text>
                    </View>
                    <View style={[styles.thCell, { width: 42 }]}>
                      <Text>Packaging</Text>
                    </View>
                    <View
                      style={[
                        styles.thCell,
                        { flex: 1.5, borderRightWidth: 0 },
                      ]}
                    >
                      <Text>Hasil / Status</Text>
                    </View>
                  </View>

                  {/* Table Body */}
                  {structureItems.map((item: any, iIdx: number) => {
                    const getStageStatus = (stage: string) => {
                      const cp = checkpoints.find(
                        (c: any) => c.itemId === item.id && c.stage === stage,
                      );
                      if (!cp) return "-";
                      if (cp.status === "PASS") return "✓ Lolos";
                      if (cp.status === "FAIL") return "✗ NCR";
                      return "Pending";
                    };

                    const qcStatus = getItemQCStatus(
                      item,
                      "STRUCTURE",
                      checkpoints,
                    );
                    const isAlt = iIdx % 2 === 1;

                    const statusStyle =
                      qcStatus.status === "ACCEPTED"
                        ? styles.badgePass
                        : qcStatus.status === "REVISION"
                          ? styles.badgeFail
                          : qcStatus.status === "IN_PROGRESS"
                            ? styles.badgeInProgress
                            : styles.badgePending;

                    return (
                      <View
                        key={item.id || iIdx}
                        style={[
                          styles.tableRow,
                          isAlt ? styles.tableRowAlternate : {},
                        ]}
                      >
                        <View
                          style={[
                            styles.tdCell,
                            { width: 22, alignItems: "center" },
                          ]}
                        >
                          <Text style={styles.tdTextCenter}>{iIdx + 1}</Text>
                        </View>
                        <View style={[styles.tdCell, { flex: 2 }]}>
                          <Text style={styles.tdTextBold}>{item.name}</Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 30, alignItems: "center" },
                          ]}
                        >
                          <Text style={styles.tdTextCenter}>
                            {item.qty || 1} {item.unit || "pcs"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 42, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getStageStatus("CUTTING") === "✓ Lolos"
                                ? styles.badgePass
                                : getStageStatus("CUTTING") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getStageStatus("CUTTING")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 42, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getStageStatus("SETTING") === "✓ Lolos"
                                ? styles.badgePass
                                : getStageStatus("SETTING") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getStageStatus("SETTING")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 42, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getStageStatus("WELDING") === "✓ Lolos"
                                ? styles.badgePass
                                : getStageStatus("WELDING") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getStageStatus("WELDING")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 42, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getStageStatus("FINISHING") === "✓ Lolos"
                                ? styles.badgePass
                                : getStageStatus("FINISHING") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getStageStatus("FINISHING")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 42, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getStageStatus("PAINTING") === "✓ Lolos"
                                ? styles.badgePass
                                : getStageStatus("PAINTING") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getStageStatus("PAINTING")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 42, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getStageStatus("PACKAGING") === "✓ Lolos"
                                ? styles.badgePass
                                : getStageStatus("PACKAGING") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getStageStatus("PACKAGING")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            {
                              flex: 1.5,
                              borderRightWidth: 0,
                              alignItems: "center",
                            },
                          ]}
                        >
                          <Text style={statusStyle}>{qcStatus.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Mechanical Items Inspection Table */}
            {mechanicalItems.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    fontFamily: "Helvetica-Bold",
                    fontSize: 7.5,
                    marginBottom: 3,
                    color: "#1e293b",
                  }}
                >
                  B. PEMERIKSAAN KOMPONEN MEKANIKAL (ASSEMBLY & PROCUREMENT)
                </Text>
                <View style={styles.table}>
                  {/* Table Head */}
                  <View style={styles.tableHeaderRow}>
                    <View style={[styles.thCell, { width: 22 }]}>
                      <Text>No.</Text>
                    </View>
                    <View style={[styles.thCell, { flex: 2 }]}>
                      <Text>Nama Komponen Mekanikal</Text>
                    </View>
                    <View style={[styles.thCell, { width: 30 }]}>
                      <Text>Qty</Text>
                    </View>
                    <View style={[styles.thCell, { flex: 1 }]}>
                      <Text>Procurement / SPB</Text>
                    </View>
                    <View style={[styles.thCell, { flex: 1 }]}>
                      <Text>Penerimaan QC</Text>
                    </View>
                    <View style={[styles.thCell, { flex: 1 }]}>
                      <Text>Assembly</Text>
                    </View>
                    <View style={[styles.thCell, { flex: 1 }]}>
                      <Text>Packaging</Text>
                    </View>
                    <View
                      style={[
                        styles.thCell,
                        { flex: 1.5, borderRightWidth: 0 },
                      ]}
                    >
                      <Text>Hasil / Status</Text>
                    </View>
                  </View>

                  {/* Table Body */}
                  {mechanicalItems.map((item: any, mIdx: number) => {
                    const getMechStageStatus = (stage: string) => {
                      const cp = checkpoints.find(
                        (c: any) =>
                          c.itemId === item.id &&
                          (c.stage === stage ||
                            (stage === "PENERIMAAN_QC" &&
                              (c.stage === "PO" || c.stage === "RECEIPT")) ||
                            (stage === "ASSEMBLY" &&
                              c.stage === "FABRICATION")),
                      );
                      if (!cp) return "-";
                      if (cp.status === "PASS") return "✓ Lolos";
                      if (cp.status === "FAIL") return "✗ NCR";
                      return "Pending";
                    };

                    const qcStatus = getItemQCStatus(
                      item,
                      "MECHANICAL",
                      checkpoints,
                    );
                    const isAlt = mIdx % 2 === 1;

                    const statusStyle =
                      qcStatus.status === "ACCEPTED"
                        ? styles.badgePass
                        : qcStatus.status === "REVISION"
                          ? styles.badgeFail
                          : qcStatus.status === "IN_PROGRESS"
                            ? styles.badgeInProgress
                            : styles.badgePending;

                    return (
                      <View
                        key={item.id || mIdx}
                        style={[
                          styles.tableRow,
                          isAlt ? styles.tableRowAlternate : {},
                        ]}
                      >
                        <View
                          style={[
                            styles.tdCell,
                            { width: 22, alignItems: "center" },
                          ]}
                        >
                          <Text style={styles.tdTextCenter}>{mIdx + 1}</Text>
                        </View>
                        <View style={[styles.tdCell, { flex: 2 }]}>
                          <Text style={styles.tdTextBold}>{item.name}</Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { width: 30, alignItems: "center" },
                          ]}
                        >
                          <Text style={styles.tdTextCenter}>
                            {item.qty || 1} {item.unit || "unit"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { flex: 1, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getMechStageStatus("PROCUREMENT") === "✓ Lolos"
                                ? styles.badgePass
                                : getMechStageStatus("PROCUREMENT") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getMechStageStatus("PROCUREMENT")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { flex: 1, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getMechStageStatus("PENERIMAAN_QC") === "✓ Lolos"
                                ? styles.badgePass
                                : getMechStageStatus("PENERIMAAN_QC") ===
                                    "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getMechStageStatus("PENERIMAAN_QC")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { flex: 1, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getMechStageStatus("ASSEMBLY") === "✓ Lolos"
                                ? styles.badgePass
                                : getMechStageStatus("ASSEMBLY") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getMechStageStatus("ASSEMBLY")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            { flex: 1, alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={
                              getMechStageStatus("PACKAGING") === "✓ Lolos"
                                ? styles.badgePass
                                : getMechStageStatus("PACKAGING") === "✗ NCR"
                                  ? styles.badgeFail
                                  : styles.badgePending
                            }
                          >
                            {getMechStageStatus("PACKAGING")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.tdCell,
                            {
                              flex: 1.5,
                              borderRightWidth: 0,
                              alignItems: "center",
                            },
                          ]}
                        >
                          <Text style={statusStyle}>{qcStatus.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Results & Notes Box */}
            <View style={styles.resultContainer}>
              <View style={styles.resultRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultLabel}>
                    Catatan Hasil Inspeksi:
                  </Text>
                  {notes.map((n, nIdx) => (
                    <Text
                      key={nIdx}
                      style={{ fontSize: 7, color: "#334155", marginTop: 1.5 }}
                    >
                      • {n}
                    </Text>
                  ))}
                </View>
                <View style={styles.checkboxGroup}>
                  <View style={styles.checkboxItem}>
                    <View style={styles.checkboxBox}>
                      {isFinalAccepted && (
                        <Text style={styles.checkboxCheck}>X</Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontFamily: "Helvetica-Bold",
                        fontSize: 8,
                        color: "#047857",
                      }}
                    >
                      Accepted (Lolos)
                    </Text>
                  </View>
                  <View style={styles.checkboxItem}>
                    <View style={styles.checkboxBox}>
                      {!isFinalAccepted && (
                        <Text style={styles.checkboxCheck}>X</Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontFamily: "Helvetica-Bold",
                        fontSize: 8,
                        color: "#b91c1c",
                      }}
                    >
                      Rejected
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Signature Block (3 Parties) */}
            <View style={styles.signTable}>
              <View style={styles.signHeaderRow}>
                <View style={styles.signHeaderCell}>
                  <Text>Prepared & Checked</Text>
                  <Text style={{ fontSize: 6, color: "#475569" }}>
                    QC PT. JLU
                  </Text>
                </View>
                <View style={styles.signHeaderCell}>
                  <Text>Checked by</Text>
                  <Text style={{ fontSize: 6, color: "#475569" }}>
                    PRODUKSI PT. JLU
                  </Text>
                </View>
                <View style={[styles.signHeaderCell, { borderRightWidth: 0 }]}>
                  <Text>Approved</Text>
                  <Text style={{ fontSize: 6, color: "#475569" }}>
                    PROJECT MANAGER PT. JLU
                  </Text>
                </View>
              </View>

              <View style={styles.signBodyRow}>
                <View style={styles.signBodyCell}>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
                    ( {signatories.qcInspector || "QC Inspector"} )
                  </Text>
                </View>
                <View style={styles.signBodyCell}>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
                    ( {signatories.productionHead || "Kepala Produksi"} )
                  </Text>
                </View>
                <View style={[styles.signBodyCell, { borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>
                    ( {signatories.projectManager || "Project Manager"} )
                  </Text>
                </View>
              </View>

              <View style={styles.signFooterRow}>
                <View style={styles.signFooterCell}>
                  <Text>Sign / Date: {inspectionDate}</Text>
                </View>
                <View style={styles.signFooterCell}>
                  <Text>Sign / Date: {inspectionDate}</Text>
                </View>
                <View style={[styles.signFooterCell, { borderRightWidth: 0 }]}>
                  <Text>Sign / Date: {inspectionDate}</Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.pageFooter}>
              <Text>PT. Jasa Laksa Utama — QC Inspection Report</Text>
              <Text>
                No. QC: {reportNumber} • Halaman {uIdx + 2}
              </Text>
            </View>
          </Page>
        );
      })}

      {/* ======================================================== */}
      {/* 3. PHOTO DOCUMENTATION PAGES                             */}
      {/* ======================================================== */}
      {(() => {
        if (!progressPhotos || progressPhotos.length === 0) return null;

        const photoChunks: any[][] = [];
        for (let i = 0; i < progressPhotos.length; i += 6) {
          photoChunks.push(progressPhotos.slice(i, i + 6));
        }

        return photoChunks.map((chunkPhotos, chunkIdx) => (
          <Page
            key={`photos-page-${chunkIdx}`}
            size="A4"
            style={styles.page}
          >
            {/* Header */}
            <View style={styles.docHeaderContainer}>
              <View style={styles.docTitleBanner}>
                <Text style={styles.docTitleText}>
                  DOKUMENTASI FOTO HASIL FABRIKASI & QUALITY CONTROL
                </Text>
              </View>
              <View style={styles.metaGrid}>
                <View style={styles.metaCol}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>CLIENT</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{clientName}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>PROYEK</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>
                      {project?.projectName || "-"}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaCol}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>REPORT No.</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{reportNumber}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>TANGGAL DOKUMENTASI</Text>
                    <Text style={styles.metaColon}>:</Text>
                    <Text style={styles.metaValue}>{inspectionDate}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Photo Grid */}
            <View style={styles.photoGrid}>
              {chunkPhotos.map((photo: any, pIdx: number) => {
                const globalIdx = chunkIdx * 6 + pIdx + 1;
                const isQC = photo.isQC || photo.category === "QC_INSPECTION";
                const metaText = isQC
                  ? "Dokumentasi: Hasil Inspeksi QC"
                  : `Dokumentasi Produksi${photo.stage ? ` • ${photo.stage}` : ""}`;

                return (
                  <View key={photo.id || pIdx} style={styles.photoCard}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={photo.url} style={styles.photoImage} />
                    <View style={styles.photoCaptionBox}>
                      <Text style={styles.photoCaptionText}>
                        {photo.caption || `Dokumentasi Foto #${globalIdx}`}
                      </Text>
                      <Text style={styles.photoMetaText}>
                        {metaText}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Footer */}
            <View style={styles.pageFooter}>
              <Text>PT. Jasa Laksa Utama — Dokumentasi Foto Fabrikasi & QC</Text>
              <Text>
                No. QC: {reportNumber} • Halaman Lampiran Foto ({chunkIdx + 1}/{photoChunks.length})
              </Text>
            </View>
          </Page>
        ));
      })()}

      {/* ======================================================== */}
      {/* 4. NCR & CORRECTIVE ACTION ATTACHMENT (IF ANY)           */}
      {/* ======================================================== */}
      {ncrs.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.docHeaderContainer}>
            <View style={styles.docTitleBanner}>
              <Text style={styles.docTitleText}>
                CATATAN KETIDAKSESUAIAN (NCR) & TINDAKAN PERBAIKAN
              </Text>
            </View>
            <View style={styles.metaGrid}>
              <View style={styles.metaCol}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>CLIENT</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>{clientName}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>PROYEK</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>
                    {project?.projectName || "-"}
                  </Text>
                </View>
              </View>
              <View style={styles.metaCol}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>REPORT No.</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>{reportNumber}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>TOTAL NCR</Text>
                  <Text style={styles.metaColon}>:</Text>
                  <Text style={styles.metaValue}>
                    {ncrs.length} Temuan Revisi
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, { width: 22 }]}>
                <Text>No.</Text>
              </View>
              <View style={[styles.thCell, { width: 75 }]}>
                <Text>No. NCR</Text>
              </View>
              <View style={[styles.thCell, { width: 60 }]}>
                <Text>Kategori</Text>
              </View>
              <View style={[styles.thCell, { flex: 2 }]}>
                <Text>Deskripsi Temuan</Text>
              </View>
              <View style={[styles.thCell, { flex: 2 }]}>
                <Text>Tindakan Perbaikan</Text>
              </View>
              <View style={[styles.thCell, { width: 50, borderRightWidth: 0 }]}>
                <Text>Status</Text>
              </View>
            </View>

            {ncrs.map((ncr: any, nIdx: number) => {
              const isAlt = nIdx % 2 === 1;
              return (
                <View
                  key={ncr.id || nIdx}
                  style={[
                    styles.tableRow,
                    isAlt ? styles.tableRowAlternate : {},
                  ]}
                >
                  <View
                    style={[styles.tdCell, { width: 22, alignItems: "center" }]}
                  >
                    <Text style={styles.tdTextCenter}>{nIdx + 1}</Text>
                  </View>
                  <View style={[styles.tdCell, { width: 75 }]}>
                    <Text style={styles.tdTextBold}>
                      {ncr.ncrNumber || `NCR-${nIdx + 1}`}
                    </Text>
                  </View>
                  <View style={[styles.tdCell, { width: 60 }]}>
                    <Text style={styles.tdText}>{ncr.ncrCategory || "-"}</Text>
                  </View>
                  <View style={[styles.tdCell, { flex: 2 }]}>
                    <Text style={styles.tdText}>
                      {ncr.ncrDescription || "-"}
                    </Text>
                  </View>
                  <View style={[styles.tdCell, { flex: 2 }]}>
                    <Text style={styles.tdText}>
                      {ncr.correctiveAction || "-"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.tdCell,
                      { width: 50, borderRightWidth: 0, alignItems: "center" },
                    ]}
                  >
                    <Text
                      style={
                        ncr.status === "CLOSED" || ncr.status === "RESOLVED"
                          ? styles.badgePass
                          : styles.badgeFail
                      }
                    >
                      {ncr.status || "OPEN"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.pageFooter}>
            <Text>PT. Jasa Laksa Utama — Lampiran NCR & Perbaikan</Text>
            <Text>No. QC: {reportNumber} • Halaman Lampiran NCR</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}

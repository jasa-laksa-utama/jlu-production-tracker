import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

export interface QCReceiptReportPDFProps {
  purchaseOrder: any;
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 10,
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: 34,
    height: 34,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    marginLeft: 6,
    color: "#0f172a",
  },
  companySubtitle: {
    fontSize: 6.5,
    color: "#475569",
    marginLeft: 6,
    marginTop: 1,
  },
  titleBadge: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    padding: "6px 12px",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "center",
    borderRadius: 2,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  metaCol: {
    width: "48%",
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    width: "36%",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#475569",
  },
  metaValue: {
    width: "64%",
    fontSize: 7.5,
    color: "#0f172a",
  },
  metaValueBold: {
    width: "64%",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  statusBadgeContainer: {
    marginTop: 4,
    padding: "3px 6px",
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#1e293b",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
    paddingHorizontal: 3,
    minHeight: 18,
    alignItems: "center",
  },
  tableRowEven: {
    backgroundColor: "#fafafa",
  },
  tableCell: {
    fontSize: 7,
    color: "#1e293b",
  },
  tableCellCenter: {
    fontSize: 7,
    color: "#1e293b",
    textAlign: "center",
  },
  badgePass: {
    color: "#047857",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    backgroundColor: "#ecfdf5",
    padding: "1.5px 3px",
    borderRadius: 2,
    textAlign: "center",
  },
  badgeUseAsIs: {
    color: "#b45309",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    backgroundColor: "#fef3c7",
    padding: "1.5px 3px",
    borderRadius: 2,
    textAlign: "center",
  },
  badgeReturn: {
    color: "#b91c1c",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    backgroundColor: "#fee2e2",
    padding: "1.5px 3px",
    borderRadius: 2,
    textAlign: "center",
  },
  badgePending: {
    color: "#475569",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    backgroundColor: "#f1f5f9",
    padding: "1.5px 3px",
    borderRadius: 2,
    textAlign: "center",
  },
  notesSection: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 6,
    marginBottom: 12,
  },
  notesTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#334155",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 7,
    color: "#475569",
    lineHeight: 1.3,
  },
  signaturesSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
  },
  signBox: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 6,
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  signTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 4,
  },
  digitalSignArea: {
    height: 44,
    width: "90%",
    borderWidth: 0.8,
    borderStyle: "dashed",
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
    marginVertical: 3,
  },
  digitalSignAreaPending: {
    height: 44,
    width: "90%",
    borderWidth: 0.8,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 3,
  },
  digitalSignHeader: {
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    color: "#047857",
    letterSpacing: 0.5,
  },
  digitalSignName: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#065f46",
    marginTop: 1,
    textAlign: "center",
  },
  digitalSignTime: {
    fontSize: 5.5,
    color: "#047857",
    marginTop: 1,
  },
  signLine: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginTop: 3,
    textAlign: "center",
  },
  signRole: {
    fontSize: 6,
    color: "#64748b",
    marginTop: 1,
  },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 24,
    right: 24,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6,
    color: "#94a3b8",
  },
});

function formatDate(dateInput: any) {
  if (!dateInput) return "-";
  try {
    const d = new Date(dateInput);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(dateInput);
  }
}

function formatDateTime(dateInput: any) {
  if (!dateInput) return "-";
  try {
    const d = new Date(dateInput);
    return `${d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;
  } catch {
    return String(dateInput);
  }
}

export function QCReceiptReportPDF({
  purchaseOrder,
}: QCReceiptReportPDFProps) {
  const po = purchaseOrder || {};
  const items = po.items || [];
  const reportNo =
    po.qcReportNumber || `QCR-${po.nomorPO?.replace(/[^a-zA-Z0-9-]/g, "") || "PO"}`;

  return (
    <Document title={`Laporan_QC_${reportNo}.pdf`}>
      <Page size="A4" style={styles.page}>
        {/* Header Kop Surat */}
        <View style={styles.headerContainer}>
          <View style={styles.logoSection}>
            <Image src="/jlu-logo.png" style={styles.logoImage} />
            <View>
              <Text style={styles.companyName}>PT. JASA LAKSA UTAMA</Text>
              <Text style={styles.companySubtitle}>
                Specialist in Conveyor System & Material Handling Equipment
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.titleBadge}>BERITA ACARA QC PENERIMAAN BARANG</Text>
          </View>
        </View>

        {/* Metadata Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No. Laporan QC</Text>
              <Text style={styles.metaValueBold}>: {reportNo}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No. Purchase Order</Text>
              <Text style={styles.metaValueBold}>: {po.nomorPO || "-"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Supplier / Vendor</Text>
              <Text style={styles.metaValue}>: {po.kepada || po.supplier?.name || "-"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Proyek / Alokasi</Text>
              <Text style={styles.metaValue}>: {po.projek || "Gudang / Persediaan Umum"}</Text>
            </View>
          </View>

          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Tanggal Pengujian</Text>
              <Text style={styles.metaValue}>: {formatDate(po.qcRequestedAt || po.createdAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Inspector QC</Text>
              <Text style={styles.metaValue}>: {po.qcApprovedBy || "QC Inspector"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status Global QC</Text>
              <Text style={styles.metaValueBold}>
                : {po.qcStatus === "APPROVED"
                  ? "APPROVED (Lolos)"
                  : po.qcStatus === "PARTIAL"
                  ? "PARTIAL (Sebagian Lolos)"
                  : po.qcStatus === "REJECTED"
                  ? "REJECTED (Ditolak)"
                  : "PENDING APPROVAL"}
              </Text>
            </View>
          </View>
        </View>

        {/* Table Hasil Uji Per Item */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: "4%" }]}>No</Text>
            <Text style={[styles.tableHeaderCell, { width: "36%", textAlign: "left", paddingLeft: 4 }]}>
              Nama Barang & Spesifikasi Teknis
            </Text>
            <Text style={[styles.tableHeaderCell, { width: "10%" }]}>Qty PO</Text>
            <Text style={[styles.tableHeaderCell, { width: "10%" }]}>Lolos</Text>
            <Text style={[styles.tableHeaderCell, { width: "10%" }]}>Reject</Text>
            <Text style={[styles.tableHeaderCell, { width: "14%" }]}>Status & Disposisi</Text>
            <Text style={[styles.tableHeaderCell, { width: "16%", textAlign: "left", paddingLeft: 4 }]}>
              Alasan / Analisa Teknis
            </Text>
          </View>

          {items.map((it: any, idx: number) => {
            const isEven = idx % 2 === 1;
            const pQty = Number(it.qtyPassed) || 0;
            const rQty = Number(it.qtyFailed) || 0;
            const isUseAsIs = it.qcDisposition === "USE_AS_IS";
            const isReturn = it.qcDisposition === "RETURN_TO_VENDOR";

            let statusComponent = (
              <Text style={styles.badgePending}>BELUM DIUJI</Text>
            );

            if (pQty > 0 && rQty === 0) {
              statusComponent = <Text style={styles.badgePass}>PASSED</Text>;
            } else if (rQty > 0) {
              if (isUseAsIs) {
                statusComponent = (
                  <Text style={styles.badgeUseAsIs}>REJECT (USE AS-IS)</Text>
                );
              } else if (isReturn) {
                statusComponent = (
                  <Text style={styles.badgeReturn}>REJECT (RETUR)</Text>
                );
              } else {
                statusComponent = (
                  <Text style={styles.badgeReturn}>REJECTED</Text>
                );
              }
            }

            return (
              <View
                key={it.id || idx}
                style={[styles.tableRow, isEven ? styles.tableRowEven : {}]}
              >
                <Text style={[styles.tableCellCenter, { width: "4%" }]}>
                  {idx + 1}
                </Text>
                <View style={{ width: "36%", paddingLeft: 4, paddingRight: 4 }}>
                  <Text style={[styles.tableCell, { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: "#0f172a" }]}>
                    {it.namaBarang}
                  </Text>
                  {it.noticeMerkJenis ? (
                    <Text style={{ fontSize: 6, color: "#475569", marginTop: 1 }}>
                      Merk: {it.noticeMerkJenis}
                    </Text>
                  ) : null}
                  {it.ukuran ? (
                    <Text style={{ fontSize: 6, color: "#334155", marginTop: 1 }}>
                      Spesifikasi: {it.ukuran}
                    </Text>
                  ) : null}
                  {it.noSpb ? (
                    <Text style={{ fontSize: 6, color: "#64748b", marginTop: 1 }}>
                      No SPB: {it.noSpb}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.tableCellCenter, { width: "10%" }]}>
                  {it.qty} {it.satuan || "pcs"}
                </Text>
                <Text
                  style={[
                    styles.tableCellCenter,
                    { width: "10%", color: "#047857", fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {pQty} {it.satuan || "pcs"}
                </Text>
                <Text
                  style={[
                    styles.tableCellCenter,
                    {
                      width: "10%",
                      color: rQty > 0 ? "#b91c1c" : "#64748b",
                      fontFamily: rQty > 0 ? "Helvetica-Bold" : "Helvetica",
                    },
                  ]}
                >
                  {rQty} {it.satuan || "pcs"}
                </Text>
                <View style={{ width: "14%", alignItems: "center" }}>
                  {statusComponent}
                </View>
                <View style={{ width: "16%", paddingLeft: 4 }}>
                  {it.qcDefectReason ? (
                    <Text style={{ fontSize: 6, color: "#b91c1c", fontFamily: "Helvetica-Bold" }}>
                      Cacat: {it.qcDefectReason}
                    </Text>
                  ) : it.qcNotes ? (
                    <Text style={{ fontSize: 6, color: "#334155" }}>
                      {it.qcNotes}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 6, color: "#94a3b8" }}>-</Text>
                  )}
                  {it.qcDispositionNotes ? (
                    <Text style={{ fontSize: 5.5, color: "#b45309", marginTop: 1, fontFamily: "Helvetica-Bold" }}>
                      Justifikasi Eng: {it.qcDispositionNotes}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Catatan & Disposisi Ringkas */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Catatan & Disposisi:</Text>
          <Text style={styles.notesText}>
            • <Text style={{ fontFamily: "Helvetica-Bold" }}>Catatan QC:</Text>{" "}
            {po.qcNotes || "Pemeriksaan fisik sesuai standar spesifikasi kedatangan barang."}
          </Text>
          {po.qcEngineeringNotes && (
            <Text style={styles.notesText}>
              • <Text style={{ fontFamily: "Helvetica-Bold" }}>Disposisi Engineering:</Text>{" "}
              {po.qcEngineeringNotes}
            </Text>
          )}
          {po.qcPmNotes && (
            <Text style={styles.notesText}>
              • <Text style={{ fontFamily: "Helvetica-Bold" }}>Catatan Project Manager:</Text>{" "}
              {po.qcPmNotes}
            </Text>
          )}
        </View>

        {/* 3 Kolom Digital Signatures */}
        <View style={styles.signaturesSection}>
          {/* 1. QC Inspector */}
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>DIBUAT / DIPERIKSA OLEH</Text>
            <View style={styles.digitalSignArea}>
              <Text style={styles.digitalSignHeader}>DIGITALLY SIGNED</Text>
              <Text style={styles.digitalSignName}>
                {po.qcApprovedBy || "QC INSPECTOR"}
              </Text>
              <Text style={styles.digitalSignTime}>
                {formatDateTime(po.qcApprovedAt || po.createdAt)}
              </Text>
            </View>
            <Text style={styles.signLine}>
              ( {po.qcApprovedBy || "QC Inspector"} )
            </Text>
            <Text style={styles.signRole}>Quality Control</Text>
          </View>

          {/* 2. Engineering Verification */}
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>DIVERIFIKASI / DISPOSISI</Text>
            {po.qcApprovedByEngineering ? (
              <View style={styles.digitalSignArea}>
                <Text style={styles.digitalSignHeader}>DIGITALLY SIGNED</Text>
                <Text style={styles.digitalSignName}>
                  {po.qcApprovedByEngineeringName || "ENGINEERING"}
                </Text>
                <Text style={styles.digitalSignTime}>
                  {formatDateTime(po.qcApprovedByEngineeringAt)}
                </Text>
              </View>
            ) : (
              <View style={styles.digitalSignAreaPending}>
                <Text style={{ fontSize: 6.5, color: "#94a3b8", fontStyle: "italic" }}>
                  Menunggu Approval
                </Text>
              </View>
            )}
            <Text style={styles.signLine}>
              ( {po.qcApprovedByEngineeringName || "Engineering"} )
            </Text>
            <Text style={styles.signRole}>Engineering Division</Text>
          </View>

          {/* 3. Project Manager Approval */}
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>DISETUJUI OLEH</Text>
            {po.qcApprovedByPm ? (
              <View style={styles.digitalSignArea}>
                <Text style={styles.digitalSignHeader}>DIGITALLY SIGNED</Text>
                <Text style={styles.digitalSignName}>
                  {po.qcApprovedByPmName || "PROJECT MANAGER"}
                </Text>
                <Text style={styles.digitalSignTime}>
                  {formatDateTime(po.qcApprovedByPmAt)}
                </Text>
              </View>
            ) : (
              <View style={styles.digitalSignAreaPending}>
                <Text style={{ fontSize: 6.5, color: "#94a3b8", fontStyle: "italic" }}>
                  Menunggu Approval
                </Text>
              </View>
            )}
            <Text style={styles.signLine}>
              ( {po.qcApprovedByPmName || "Project Manager"} )
            </Text>
            <Text style={styles.signRole}>Project Manager</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>PT. Jasa Laksa Utama - Sistem Pelacakan Produksi & QC</Text>
          <Text>Dokumen ini sah dengan Tanda Tangan Digital resmi sistem JLU.</Text>
        </View>
      </Page>
    </Document>
  );
}

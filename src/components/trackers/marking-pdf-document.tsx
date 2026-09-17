import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { MarkingOverviewItem } from "@/app/actions/marking-management";

export interface MarkingPDFDocumentProps {
  projectName?: string;
  items: MarkingOverviewItem[];
  unitFilterName?: string;
  typeFilterName?: string;
  totalMarkedCount?: number;
  totalItemCount?: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  // KOP & Header
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 8,
  },
  companySection: {
    flexDirection: "column",
  },
  companyName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    color: "#0f172a",
  },
  companySubtitle: {
    fontSize: 7,
    color: "#475569",
    marginTop: 1,
  },
  titleBadgeContainer: {
    alignItems: "flex-end",
  },
  titleBadge: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    padding: "5px 10px",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "center",
    borderRadius: 3,
  },
  docNumber: {
    fontSize: 7,
    color: "#64748b",
    marginTop: 2,
    fontFamily: "Helvetica",
  },

  // Meta Grid Info Box
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 7,
    marginBottom: 10,
  },
  metaCol: {
    width: "32%",
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2.5,
  },
  metaLabel: {
    width: "42%",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#475569",
  },
  metaColon: {
    width: "6%",
    fontSize: 7.5,
    color: "#475569",
  },
  metaValue: {
    width: "52%",
    fontSize: 7.5,
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  metaValueBold: {
    width: "52%",
    fontSize: 7.5,
    color: "#0f172a",
    fontFamily: "Helvetica-Bold",
  },

  // Table
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
    paddingVertical: 5,
    paddingHorizontal: 3,
    alignItems: "center",
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.2,
    color: "#1e293b",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 3.5,
    paddingHorizontal: 3,
    minHeight: 18,
    alignItems: "center",
  },
  tableRowUnit: {
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  tableRowEven: {
    backgroundColor: "#fafafa",
  },
  tableRowSub: {
    backgroundColor: "#f8fafc",
  },

  // Cell Types
  cellNo: {
    width: "4%",
    textAlign: "center",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  cellUnit: {
    width: "15%",
    paddingHorizontal: 3,
    fontSize: 7,
    color: "#334155",
    fontFamily: "Helvetica-Bold",
  },
  cellDesc: {
    width: "23%",
    paddingHorizontal: 3,
    fontSize: 7.5,
    color: "#0f172a",
  },
  cellDescSub: {
    width: "23%",
    paddingHorizontal: 3,
    paddingLeft: 8,
    fontSize: 7,
    color: "#1e293b",
  },
  cellType: {
    width: "8%",
    textAlign: "center",
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  cellSpec: {
    width: "14%",
    paddingHorizontal: 3,
    fontSize: 6.8,
    color: "#475569",
    fontFamily: "Helvetica",
  },
  cellQty: {
    width: "7%",
    textAlign: "center",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  cellMarking: {
    width: "14%",
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  markingBadge: {
    backgroundColor: "#e0e7ff",
    borderWidth: 0.8,
    borderColor: "#6366f1",
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    alignItems: "center",
    justifyContent: "center",
    width: "90%",
  },
  markingText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#4338ca",
    textAlign: "center",
  },
  markingEmpty: {
    fontFamily: "Helvetica",
    fontSize: 6.5,
    color: "#94a3b8",
    textAlign: "center",
    fontStyle: "italic",
  },
  cellStatus: {
    width: "8%",
    textAlign: "center",
    fontSize: 6.8,
    fontFamily: "Helvetica",
  },
  cellCheck: {
    width: "7%",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSquare: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: "#64748b",
    borderRadius: 1.5,
  },

  // Badge styles
  typeBadgeStr: {
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#bfdbfe",
    textAlign: "center",
    fontSize: 6,
  },
  typeBadgeMec: {
    color: "#7e22ce",
    backgroundColor: "#faf5ff",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#e9d5ff",
    textAlign: "center",
    fontSize: 6,
  },
  typeBadgeSub: {
    color: "#475569",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    textAlign: "center",
    fontSize: 5.8,
  },

  // Signatures Section
  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
  },
  signatureBox: {
    width: "30%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    padding: 6,
    backgroundColor: "#ffffff",
  },
  signatureRole: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#334155",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 3,
    marginBottom: 34, // space for signature & stamp
  },
  signatureName: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: "#0f172a",
    borderTopWidth: 0.5,
    borderTopColor: "#94a3b8",
    paddingTop: 3,
  },
  signatureDate: {
    fontSize: 6.5,
    textAlign: "center",
    color: "#64748b",
    marginTop: 1,
  },

  // Note & Footer
  notesSection: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 0.5,
    borderColor: "#e2e8f0",
    borderRadius: 2,
  },
  notesTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 1.5,
  },
  notesText: {
    fontSize: 6,
    color: "#64748b",
    lineHeight: 1.3,
  },
  pageFooter: {
    position: "absolute",
    bottom: 12,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
    fontSize: 6.5,
    color: "#94a3b8",
  },
});

export function MarkingPDFDocument({
  projectName = "Proyek Produksi JLU",
  items = [],
  unitFilterName = "Semua Unit",
  typeFilterName = "Semua Level",
  totalMarkedCount,
  totalItemCount,
}: MarkingPDFDocumentProps) {
  const currentDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const currentDateTime = `${currentDate}, ${new Date().toLocaleTimeString(
    "id-ID",
    { hour: "2-digit", minute: "2-digit" }
  )} WIB`;

  const total = totalItemCount ?? items.length;
  const marked =
    totalMarkedCount ?? items.filter((i) => Boolean(i.markingCode)).length;
  const percent = total > 0 ? Math.round((marked / total) * 100) : 0;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* KOP / HEADER PERUSAHAAN */}
        <View style={styles.headerContainer} fixed>
          <View style={styles.companySection}>
            <Text style={styles.companyName}>PT. JASA LAKSA UTAMA</Text>
            <Text style={styles.companySubtitle}>
              FABRICATION, INDUSTRIAL CONVEYOR SYSTEM, ENGINEERING & MINING SUPPLY
            </Text>
          </View>
          <View style={styles.titleBadgeContainer}>
            <Text style={styles.titleBadge}>
              LEMBAR KONTROL KODE MARKING & PACKAGING
            </Text>
            <Text style={styles.docNumber}>
              DOC-MKG/{new Date().getFullYear()}/
              {String(new Date().getMonth() + 1).padStart(2, "0")}
            </Text>
          </View>
        </View>

        {/* METADATA PROYEK */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Nama Proyek</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValueBold}>{projectName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Filter Unit</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>{unitFilterName}</Text>
            </View>
          </View>

          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Level Tipe</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>{typeFilterName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Tanggal Cetak</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValue}>{currentDateTime}</Text>
            </View>
          </View>

          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Total Komponen</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValueBold}>{total} Part</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status Ter-Marking</Text>
              <Text style={styles.metaColon}>:</Text>
              <Text style={styles.metaValueBold}>
                {marked} dari {total} ({percent}%)
              </Text>
            </View>
          </View>
        </View>

        {/* TABEL DATA KODE MARKING */}
        <View style={styles.table}>
          {/* Table Header (Fixed so repeats on every page) */}
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, styles.cellNo]}>NO</Text>
            <Text style={[styles.tableHeaderCell, styles.cellUnit]}>
              UNIT CONVEYOR
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellDesc]}>
              DESKRIPSI KOMPONEN / PART
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellType]}>TIPE</Text>
            <Text style={[styles.tableHeaderCell, styles.cellSpec]}>
              DIMENSI / SPESIFIKASI
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellQty]}>QTY</Text>
            <Text style={[styles.tableHeaderCell, styles.cellMarking]}>
              KODE MARKING
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellStatus]}>
              STATUS
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellCheck]}>
              CEK FISIK
            </Text>
          </View>

          {/* Table Body Rows */}
          {items.map((item, idx) => {
            const isUnit = item.type === "UNIT";
            const isSub =
              item.type === "STRUCTURE_SUB" || item.type === "MECHANICAL_SUB";
            const isEven = idx % 2 === 1;

            let rowStyle = styles.tableRow;
            if (isUnit) rowStyle = { ...styles.tableRow, ...styles.tableRowUnit };
            else if (isSub) rowStyle = { ...styles.tableRow, ...styles.tableRowSub };
            else if (isEven) rowStyle = { ...styles.tableRow, ...styles.tableRowEven };

            const renderTypeBadge = () => {
              if (item.type === "UNIT") return <Text style={styles.typeBadgeSub}>UNIT</Text>;
              if (item.type === "STRUCTURE")
                return <Text style={styles.typeBadgeStr}>STRUKTUR</Text>;
              if (item.type === "MECHANICAL")
                return <Text style={styles.typeBadgeMec}>MEKANIKAL</Text>;
              return <Text style={styles.typeBadgeSub}>SUB-PART</Text>;
            };

            return (
              <View key={item.id || idx} style={rowStyle} wrap={false}>
                {/* 1. No */}
                <Text style={styles.cellNo}>{idx + 1}</Text>

                {/* 2. Unit Name */}
                <Text style={styles.cellUnit}>
                  {item.unitName}
                </Text>

                {/* 3. Deskripsi Part */}
                <View style={isSub ? styles.cellDescSub : styles.cellDesc}>
                  <Text
                    style={{
                      fontFamily: isSub ? "Helvetica" : "Helvetica-Bold",
                      color: isSub ? "#334155" : "#0f172a",
                    }}
                  >
                    {item.name}
                  </Text>
                </View>

                {/* 4. Tipe Part */}
                <View style={styles.cellType}>{renderTypeBadge()}</View>

                {/* 5. Dimensi / Spesifikasi */}
                <Text style={styles.cellSpec}>
                  {item.dimensionOrSpec || "-"}
                </Text>

                {/* 6. Qty */}
                <Text style={styles.cellQty}>
                  {item.qty || 1} {item.satuan || "set"}
                </Text>

                {/* 7. Kode Marking */}
                <View style={styles.cellMarking}>
                  {item.markingCode ? (
                    <View style={styles.markingBadge}>
                      <Text style={styles.markingText}>
                        {item.markingCode}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.markingEmpty}>[ BELUM ADA ]</Text>
                  )}
                </View>

                {/* 8. Status */}
                <Text
                  style={[
                    styles.cellStatus,
                    {
                      color: item.isCompleted ? "#059669" : "#64748b",
                      fontFamily: item.isCompleted
                        ? "Helvetica-Bold"
                        : "Helvetica",
                    },
                  ]}
                >
                  {item.isCompleted ? "SELESAI" : "PENDING"}
                </Text>

                {/* 9. Cek Fisik Lapangan */}
                <View style={styles.cellCheck}>
                  <View style={styles.checkboxSquare} />
                </View>
              </View>
            );
          })}
        </View>

        {/* KOLOM TANDA TANGAN & PENGESAHAN */}
        <View style={styles.signaturesContainer} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>
              DIBUAT / DITANDAI OLEH:
            </Text>
            <Text style={styles.signatureName}>
              ( .................................................. )
            </Text>
            <Text style={styles.signatureDate}>
              PIC Fabrikasi / Marking
            </Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>
              DIPERIKSA & DIVERIFIKASI OLEH:
            </Text>
            <Text style={styles.signatureName}>
              ( .................................................. )
            </Text>
            <Text style={styles.signatureDate}>
              Quality Control (QC Inspector)
            </Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>
              DISETUJUI OLEH:
            </Text>
            <Text style={styles.signatureName}>
              ( .................................................. )
            </Text>
            <Text style={styles.signatureDate}>
              Project Manager / Workshop Head
            </Text>
          </View>
        </View>

        {/* CATATAN PENTING DOKUMEN */}
        <View style={styles.notesSection} wrap={false}>
          <Text style={styles.notesTitle}>PETUNJUK PENGGUNAAN LEMBAR MARKING:</Text>
          <Text style={styles.notesText}>
            1. Lembar kontrol ini merupakan dokumen resmi penandaan fisik komponen fabrikasi untuk identifikasi packaging, pengiriman, dan perakitan site.
            {"\n"}
            2. Pastikan setiap komponen fisik telah dicap / ditandai secara permanen sesuai kode marking sebelum dimasukkan ke bundel atau palet.
            {"\n"}
            3. Berikan tanda centang (✓) pada kolom Cek Fisik setelah verifikasi fisik dilakukan oleh tim QC / Packaging.
          </Text>
        </View>

        {/* FOOTER HALAMAN */}
        <View style={styles.pageFooter} fixed>
          <Text>PT. Jasa Laksa Utama — Production & Marking Tracking System</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Halaman ${pageNumber} dari ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

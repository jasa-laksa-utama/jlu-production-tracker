import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

interface SPBItem {
  name: string;
  qty: number;
  source: string;
  unit: string;
  note?: string;
  typeMerk?: string;
}

interface SPBData {
  id: string;
  spbNumber?: string | null;
  date: string;
  deadlineDate?: string | Date | null;
  imageUrl?: string | null;
  items: SPBItem[];
  makerName?: string | null;
  mengetahuiName?: string | null;
  menyetujuiName?: string | null;
  createdAt?: string | Date | null;
  approvedByPpic?: boolean | null;
  approvedByPpicAt?: string | Date | null;
  approvedByPm?: boolean | null;
  approvedByPmAt?: string | Date | null;
}

interface SPBPDFDocumentProps {
  spb: SPBData;
  project: any;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#000",
    position: "relative",
    height: "100%",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  logoImage: {
    width: 36,
    height: 36,
    objectFit: "contain",
  },
  titleBadge: {
    backgroundColor: "#000",
    color: "#fff",
    padding: "8px 15px",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textAlign: "center",
  },
  divider: {
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    marginBottom: 15,
    marginTop: 5,
  },
  subHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  leftSubHeader: {
    width: "40%",
  },
  rightSubHeader: {
    width: "55%",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
    fontSize: 10,
    alignItems: "flex-end",
  },
  infoLabel: {
    fontFamily: "Helvetica-Bold",
  },
  infoValue: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    paddingBottom: 2,
    marginLeft: 4,
  },
  table: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#000",
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    backgroundColor: "#f5f5f5",
    height: 24,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    height: 30,
    alignItems: "center",
  },
  tableRowLast: {
    flexDirection: "row",
    height: 30,
    alignItems: "center",
  },
  colNo: {
    width: "10%",
    textAlign: "center",
    borderRightWidth: 1.5,
    borderRightColor: "#000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  colMaterial: {
    width: "45%",
    borderRightWidth: 1.5,
    borderRightColor: "#000",
    paddingLeft: 6,
    height: "100%",
    justifyContent: "center",
  },
  colQty: {
    width: "15%",
    textAlign: "center",
    borderRightWidth: 1.5,
    borderRightColor: "#000",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  colKeterangan: {
    width: "30%",
    paddingLeft: 6,
    height: "100%",
    justifyContent: "center",
  },
  thText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "center",
  },
  tdText: {
    fontSize: 9,
  },
  tdTextBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  notesSection: {
    marginTop: 10,
    fontSize: 10,
  },
  notesTitle: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  notesContent: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    paddingBottom: 4,
    minHeight: 18,
  },
  dateRow: {
    textAlign: "right",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginRight: 40,
  },
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingLeft: 15,
    paddingRight: 15,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  signatureBox: {
    textAlign: "center",
    width: 140,
  },
  signatureSpace: {
    height: 60,
  },
  digitalSignContainer: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "#10b981",
    borderStyle: "dashed",
    borderRadius: 4,
    marginVertical: 4,
    padding: 4,
    backgroundColor: "#f0fdf4",
  },
  digitalSignText: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#10b981",
  },
  digitalSignName: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f766e",
    marginTop: 2,
    marginBottom: 1,
    textTransform: "uppercase",
  },
  digitalSignDate: {
    fontSize: 5.5,
    color: "#6b7280",
  },
  signatureLine: {
    fontWeight: "normal",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    borderTopWidth: 1.5,
    borderTopColor: "#000",
    paddingTop: 6,
    color: "#444",
  },
});

export function SPBPDFDocument({ spb, project }: SPBPDFDocumentProps) {
  const totalRowsCount = Math.max(8, spb.items.length);

  const formatIndonesianDate = (date: Date) => {
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formattedDate = formatIndonesianDate(new Date());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoSection}>
            <Image src="/jlu-logo.png" style={styles.logoImage} />
            <Text style={styles.companyName}>JASA LAKSA UTAMA</Text>
          </View>
          <View style={styles.titleBadge}>
            <Text>SURAT PERMINTAAN BARANG</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Subheader info fields */}
        <View style={styles.subHeaderContainer}>
          <View style={styles.leftSubHeader}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { width: 30 }]}>No :</Text>
              <Text
                style={[
                  styles.infoValue,
                  { fontFamily: "Courier", fontSize: 11 },
                ]}
              >
                {spb.spbNumber || spb.id}
              </Text>
            </View>
          </View>
          <View style={styles.rightSubHeader}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { width: 80 }]}>No. SO</Text>
              <Text style={{ width: 10 }}>:</Text>
              <Text style={styles.infoValue}>
                {project?.projectNumber ||
                  project?.id?.slice(-8).toUpperCase() ||
                  "-"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { width: 80 }]}>
                Project Name
              </Text>
              <Text style={{ width: 10 }}>:</Text>
              <Text style={styles.infoValue}>
                {project?.projectName || "-"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { width: 80 }]}>Client</Text>
              <Text style={{ width: 10 }}>:</Text>
              <Text style={styles.infoValue}>
                {project?.customer?.company || project?.customer?.name || "-"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { width: 80 }]}>Tenggat Waktu</Text>
              <Text style={{ width: 10 }}>:</Text>
              <Text style={[styles.infoValue, { fontFamily: "Helvetica-Bold" }]}>
                {spb.deadlineDate
                  ? new Date(spb.deadlineDate).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* Table with outside border */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colNo}>
              <Text style={styles.thText}>NO</Text>
            </View>
            <View style={styles.colMaterial}>
              <Text style={styles.thText}>MATERIAL</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.thText}>QTY</Text>
            </View>
            <View style={styles.colKeterangan}>
              <Text style={styles.thText}>KETERANGAN</Text>
            </View>
          </View>

          {/* Table Body Items */}
          {spb.items.map((it, idx) => {
            const isLast = idx === totalRowsCount - 1;
            return (
              <View
                key={idx}
                style={isLast ? styles.tableRowLast : styles.tableRow}
              >
                <View style={styles.colNo}>
                  <Text style={[styles.tdText, { textAlign: "center" }]}>
                    {idx + 1}
                  </Text>
                </View>
                <View style={styles.colMaterial}>
                  <Text style={styles.tdTextBold}>
                    {it.name}
                    {it.typeMerk ? ` (${it.typeMerk})` : ""}
                  </Text>
                </View>
                <View style={styles.colQty}>
                  <Text style={[styles.tdTextBold, { textAlign: "center" }]}>
                    {it.qty} {it.unit || "pcs"}
                  </Text>
                </View>
                <View style={styles.colKeterangan}>
                  <Text style={styles.tdText}>
                    {it.source === "WAREHOUSE" ? "GUDANG" : "TRADING"}
                    {it.note ? ` - ${it.note}` : ""}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Empty rows to make total 8 rows */}
          {Array.from({ length: Math.max(0, 8 - spb.items.length) }).map(
            (_, i) => {
              const idx = spb.items.length + i;
              const isLast = idx === totalRowsCount - 1;
              return (
                <View
                  key={`empty-${i}`}
                  style={isLast ? styles.tableRowLast : styles.tableRow}
                >
                  <View style={styles.colNo}>
                    <Text></Text>
                  </View>
                  <View style={styles.colMaterial}>
                    <Text></Text>
                  </View>
                  <View style={styles.colQty}>
                    <Text></Text>
                  </View>
                  <View style={styles.colKeterangan}>
                    <Text></Text>
                  </View>
                </View>
              );
            },
          )}
        </View>

        {/* Catatan */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Catatan:</Text>
          <View style={styles.notesContent}>
            <Text style={{ fontSize: 9 }}>
              {spb.items
                .map((i) => i.note)
                .filter(Boolean)
                .join(", ") || "-"}
            </Text>
          </View>
        </View>

        {/* Date */}
        <Text style={styles.dateRow}>Tangerang, {formattedDate}</Text>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text>Dibuat oleh,</Text>
            <View style={styles.digitalSignContainer}>
              <Text style={styles.digitalSignText}>DIGITALLY SIGNED BY</Text>
              <Text style={styles.digitalSignName}>
                {spb.makerName || "MAKER"}
              </Text>
              <Text style={styles.digitalSignDate}>
                {spb.createdAt
                  ? formatIndonesianDate(new Date(spb.createdAt))
                  : formattedDate}
              </Text>
            </View>
            <Text style={styles.signatureLine}>
              ( {spb.makerName || "                       "} )
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Mengetahui,</Text>
            {spb.approvedByPpic ? (
              <View style={styles.digitalSignContainer}>
                <Text style={styles.digitalSignText}>DIGITALLY SIGNED BY</Text>
                <Text style={styles.digitalSignName}>
                  {spb.mengetahuiName || "PPIC"}
                </Text>
                <Text style={styles.digitalSignDate}>
                  {spb.approvedByPpicAt
                    ? formatIndonesianDate(new Date(spb.approvedByPpicAt))
                    : formattedDate}
                </Text>
              </View>
            ) : (
              <View style={styles.signatureSpace} />
            )}
            <Text style={styles.signatureLine}>
              ( {spb.mengetahuiName || "PPIC"} )
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Menyetujui,</Text>
            {spb.approvedByPm ? (
              <View style={styles.digitalSignContainer}>
                <Text style={styles.digitalSignText}>DIGITALLY SIGNED BY</Text>
                <Text style={styles.digitalSignName}>
                  {spb.menyetujuiName || "PROJECT MANAGER"}
                </Text>
                <Text style={styles.digitalSignDate}>
                  {spb.approvedByPmAt
                    ? formatIndonesianDate(new Date(spb.approvedByPmAt))
                    : formattedDate}
                </Text>
              </View>
            ) : (
              <View style={styles.signatureSpace} />
            )}
            <Text style={styles.signatureLine}>
              ( {spb.menyetujuiName || "Project Manager"} )
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          | SPECIALIST IN CONVEYOR SYSTEM AND COMPONENT | 021 - 54370637 - 40 |
          JASALAKSAUTAMA.ID |
        </Text>
      </Page>
    </Document>
  );
}

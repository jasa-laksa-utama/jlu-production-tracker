import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatRupiah } from "@/lib/utils";

interface BoQItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemTypeMerk?: string;
  qty: number;
  unit: string;
  price: number;
  note?: string;
}

interface BoQPDFDocumentProps {
  project: any;
  items: BoQItem[];
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
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
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  companySub: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
  },
  titleBadge: {
    backgroundColor: "#000",
    color: "#fff",
    padding: "6px 12px",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "center",
  },
  divider: {
    borderBottomWidth: 1.5,
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
    width: "45%",
  },
  rightSubHeader: {
    width: "50%",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 5,
    alignItems: "flex-end",
  },
  infoLabel: {
    fontFamily: "Helvetica-Bold",
    width: 80,
  },
  infoColon: {
    width: 10,
  },
  infoValue: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 1,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    backgroundColor: "#f5f5f5",
    height: 20,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#ccc",
    height: 24,
    alignItems: "center",
  },
  colNo: {
    width: "6%",
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
    height: "100%",
    justifyContent: "center",
  },
  colCode: {
    width: "14%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    paddingLeft: 4,
    height: "100%",
    justifyContent: "center",
  },
  colName: {
    width: "35%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    paddingLeft: 4,
    height: "100%",
    justifyContent: "center",
  },
  colQty: {
    width: "10%",
    textAlign: "right",
    borderRightWidth: 1,
    borderRightColor: "#000",
    paddingRight: 4,
    height: "100%",
    justifyContent: "center",
  },
  colUnit: {
    width: "8%",
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
    height: "100%",
    justifyContent: "center",
  },
  colPrice: {
    width: "13%",
    textAlign: "right",
    borderRightWidth: 1,
    borderRightColor: "#000",
    paddingRight: 4,
    height: "100%",
    justifyContent: "center",
  },
  colSubtotal: {
    width: "14%",
    textAlign: "right",
    paddingRight: 4,
    height: "100%",
    justifyContent: "center",
  },
  thText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textAlign: "center",
  },
  tdText: {
    fontSize: 8,
  },
  tdTextBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 5,
    paddingRight: 4,
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginRight: 10,
  },
  totalVal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    paddingBottom: 2,
  },
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
    paddingLeft: 40,
    paddingRight: 40,
  },
  signatureBox: {
    textAlign: "center",
    width: 140,
  },
  signatureSpace: {
    height: 45,
  },
  digitalSignContainer: {
    height: 45,
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
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    color: "#10b981",
  },
  digitalSignName: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#0f766e",
    marginTop: 2,
    marginBottom: 1,
    textTransform: "uppercase",
  },
  digitalSignDate: {
    fontSize: 5,
    color: "#6b7280",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 0.8,
    borderTopColor: "#ccc",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#666",
    fontSize: 7,
  },
});

export function BoQPDFDocument({ project, items }: BoQPDFDocumentProps) {
  const totalValue = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

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

  const formattedRupiahLocal = (val: number) => {
    return "Rp " + val.toLocaleString("id-ID");
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.companyName}>PT. JASA LAKSA UTAMA</Text>
            <Text style={styles.companySub}>
              Production, Engineering & Logistics System
            </Text>
          </View>
          <View>
            <Text style={styles.titleBadge}>BILL OF QUANTITIES (BoQ)</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Info Rows */}
        <View style={styles.subHeaderContainer}>
          <View style={styles.leftSubHeader}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. Proyek</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={[styles.infoValue, styles.tdTextBold]}>
                {project?.projectNumber || "-"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. BoQ</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={[styles.infoValue, styles.tdTextBold]}>
                {project?.boqNumber || "-"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama Proyek</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>
                {project?.projectName || "-"}
              </Text>
            </View>
          </View>
          <View style={styles.rightSubHeader}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>
                {project?.customer?.company
                  ? `${project.customer.company} (${project.customer.name})`
                  : project?.customer?.name || "-"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal Cetak</Text>
              <Text style={styles.infoColon}>:</Text>
              <Text style={styles.infoValue}>{formattedDate}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colNo}>
              <Text style={styles.thText}>No</Text>
            </View>
            <View style={styles.colCode}>
              <Text style={styles.thText}>Kode</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.thText}>Nama Material / Item</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.thText}>Qty</Text>
            </View>
            <View style={styles.colUnit}>
              <Text style={styles.thText}>Satuan</Text>
            </View>
            <View style={styles.colPrice}>
              <Text style={styles.thText}>Harga</Text>
            </View>
            <View style={styles.colSubtotal}>
              <Text style={styles.thText}>Subtotal</Text>
            </View>
          </View>

          {items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <View style={styles.colNo}>
                <Text style={[styles.tdText, { textAlign: "center" }]}>
                  {idx + 1}
                </Text>
              </View>
              <View style={styles.colCode}>
                <Text style={[styles.tdText, styles.tdTextBold]}>
                  {item.itemCode}
                </Text>
              </View>
              <View style={styles.colName}>
                <Text style={styles.tdText}>
                  {item.itemName}
                  {item.itemTypeMerk ? ` (${item.itemTypeMerk})` : ""}
                </Text>
              </View>
              <View style={styles.colQty}>
                <Text
                  style={[
                    styles.tdText,
                    styles.tdTextBold,
                    { textAlign: "center" },
                  ]}
                >
                  {item.qty}
                </Text>
              </View>
              <View style={styles.colUnit}>
                <Text
                  style={[
                    styles.tdText,
                    { textAlign: "center", textTransform: "uppercase" },
                  ]}
                >
                  {item.unit}
                </Text>
              </View>
              <View style={styles.colPrice}>
                <Text style={[styles.tdText, { textAlign: "right" }]}>
                  {formattedRupiahLocal(item.price)}
                </Text>
              </View>
              <View style={styles.colSubtotal}>
                <Text
                  style={[
                    styles.tdText,
                    styles.tdTextBold,
                    { textAlign: "right" },
                  ]}
                >
                  {formattedRupiahLocal(item.qty * item.price)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>TOTAL NILAI BoQ:</Text>
          <Text style={styles.totalVal}>
            {formattedRupiahLocal(totalValue)}
          </Text>
        </View>

        {/* Signature */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text>Dibuat oleh,</Text>
            {project?.boqStatus && project.boqStatus !== "DRAFT" ? (
              <View style={styles.digitalSignContainer}>
                <Text style={styles.digitalSignText}>DIGITALLY SIGNED BY</Text>
                <Text style={styles.digitalSignName}>{project.boqMakerName || "ENGINEERING"}</Text>
                <Text style={styles.digitalSignDate}>
                  {project.createdAt ? formatIndonesianDate(new Date(project.createdAt)) : formattedDate}
                </Text>
              </View>
            ) : (
              <View style={styles.signatureSpace} />
            )}
            <View style={styles.signatureLine} />
            <Text>Divisi Engineering</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Mengetahui,</Text>
            {project?.boqApprovedByPpic ? (
              <View style={styles.digitalSignContainer}>
                <Text style={styles.digitalSignText}>DIGITALLY SIGNED BY</Text>
                <Text style={styles.digitalSignName}>SLAMET</Text>
                <Text style={styles.digitalSignDate}>
                  {project.boqApprovedByPpicAt ? formatIndonesianDate(new Date(project.boqApprovedByPpicAt)) : formattedDate}
                </Text>
              </View>
            ) : (
              <View style={styles.signatureSpace} />
            )}
            <View style={styles.signatureLine} />
            <Text>PPIC</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Menyetujui,</Text>
            {project?.boqApprovedByPm ? (
              <View style={styles.digitalSignContainer}>
                <Text style={styles.digitalSignText}>DIGITALLY SIGNED BY</Text>
                <Text style={styles.digitalSignName}>PROJECT MANAGER</Text>
                <Text style={styles.digitalSignDate}>
                  {project.boqApprovedByPmAt ? formatIndonesianDate(new Date(project.boqApprovedByPmAt)) : formattedDate}
                </Text>
              </View>
            ) : (
              <View style={styles.signatureSpace} />
            )}
            <View style={styles.signatureLine} />
            <Text>Project Manager</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>PT. Jasa Laksa Utama - Dokumen Kontrol Sistem BoQ</Text>
          <Text>Halaman 1 dari 1</Text>
        </View>
      </Page>
    </Document>
  );
}

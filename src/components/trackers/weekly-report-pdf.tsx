import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1.5,
    borderBottomColor: "#000",
    paddingBottom: 10,
  },
  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  documentTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    textAlign: "right",
  },
  metaSection: {
    marginBottom: 15,
    fontSize: 9,
    lineHeight: 1.4,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  metaLabel: {
    width: 80,
    fontFamily: "Helvetica-Bold",
  },
  metaValue: {
    flex: 1,
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#bfbfbf",
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeader: {
    backgroundColor: "#f2f2f2",
    borderStyle: "solid",
    borderWidth: 0.5,
    borderColor: "#bfbfbf",
    padding: 5,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableCol: {
    borderStyle: "solid",
    borderWidth: 0.5,
    borderColor: "#bfbfbf",
    padding: 5,
    fontSize: 8,
  },
  tableTotalRow: {
    flexDirection: "row",
    backgroundColor: "#e6e6e6",
    fontFamily: "Helvetica-Bold",
  },
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
    paddingLeft: 20,
    paddingRight: 20,
  },
  signatureBox: {
    width: 140,
    textAlign: "center",
  },
  signatureLine: {
    marginTop: 50,
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 4,
    fontFamily: "Helvetica-Bold",
  },
});

export function WeeklyReportPDF({ project, masterplan, units }: { project: any; masterplan: any; units: any[] }) {
  const fabPhase = masterplan.phases.find((p: any) => p.code === "FAB_STRUCT_MECH");
  const fabWeight = fabPhase ? Number(fabPhase.weightPercent || 35) : 35;

  let totalWeight = 0;
  let totalWeightedContribution = 0;

  const rows = units.map((unit) => {
    const sItems = unit.structureItems || [];
    const avgS = sItems.length > 0 
      ? sItems.reduce((sum: number, i: any) => sum + Number(i.progressPercent || 0), 0) / sItems.length
      : 0;

    const mItems = unit.mechanicalItems || [];
    const avgM = mItems.length > 0 
      ? mItems.reduce((sum: number, i: any) => sum + Number(i.progressPercent || 0), 0) / mItems.length
      : 0;

    let progress = 0;
    if (unit.unitType === "STRUCTURE") progress = avgS;
    else if (unit.unitType === "MECHANICAL") progress = avgM;
    else progress = (avgS + avgM) / 2;

    const weightShare = fabWeight / units.length;
    const contribution = (progress * weightShare) / 100;

    totalWeight += weightShare;
    totalWeightedContribution += contribution;

    return {
      name: unit.name,
      satuan: unit.satuan,
      volume: unit.volume,
      weightShare,
      progress,
      contribution,
    };
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.companyName}>PT. JASA LAKSA UTAMA</Text>
          </View>
          <View>
            <Text style={styles.documentTitle}>WEEKLY PROGRESS REPORT</Text>
          </View>
        </View>

        {/* Project Meta Info */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Project:</Text>
            <Text style={styles.metaValue}>{project.projectName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Client:</Text>
            <Text style={styles.metaValue}>{project.customer?.company || project.customer?.name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Total Weeks:</Text>
            <Text style={styles.metaValue}>{masterplan.totalWeeks} Weeks</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Start Date:</Text>
            <Text style={styles.metaValue}>{new Date(masterplan.startDate).toLocaleDateString("id-ID")}</Text>
          </View>
        </View>

        {/* Summary Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableRow}>
            <View style={[styles.tableColHeader, { flex: 3 }]}><Text>Keterangan Pekerjaan Conveyor</Text></View>
            <View style={[styles.tableColHeader, { flex: 1, textAlign: "center" }]}><Text>Satuan</Text></View>
            <View style={[styles.tableColHeader, { flex: 1, textAlign: "center" }]}><Text>Vol</Text></View>
            <View style={[styles.tableColHeader, { flex: 1.5, textAlign: "center" }]}><Text>Bobot (%)</Text></View>
            <View style={[styles.tableColHeader, { flex: 1.5, textAlign: "center" }]}><Text>Prestasi (%)</Text></View>
            <View style={[styles.tableColHeader, { flex: 1.5, textAlign: "right" }]}><Text>Kontribusi (%)</Text></View>
          </View>

          {/* Table Body Rows */}
          {rows.map((row, idx) => (
            <View key={idx} style={styles.tableRow}>
              <View style={[styles.tableCol, { flex: 3 }]}><Text>{row.name}</Text></View>
              <View style={[styles.tableCol, { flex: 1, textAlign: "center" }]}><Text>{row.satuan}</Text></View>
              <View style={[styles.tableCol, { flex: 1, textAlign: "center" }]}><Text>{row.volume}</Text></View>
              <View style={[styles.tableCol, { flex: 1.5, textAlign: "center" }]}><Text>{row.weightShare.toFixed(2)}%</Text></View>
              <View style={[styles.tableCol, { flex: 1.5, textAlign: "center" }]}><Text>{row.progress.toFixed(2)}%</Text></View>
              <View style={[styles.tableCol, { flex: 1.5, textAlign: "right" }]}><Text>{row.contribution.toFixed(2)}%</Text></View>
            </View>
          ))}

          {/* Total Row */}
          <View style={styles.tableTotalRow}>
            <View style={[styles.tableCol, { flex: 5 }]}><Text>TOTAL PEKERJAAN CONVEYOR</Text></View>
            <View style={[styles.tableCol, { flex: 1.5, textAlign: "center" }]}><Text>{totalWeight.toFixed(2)}%</Text></View>
            <View style={[styles.tableCol, { flex: 1.5, textAlign: "center" }]}><Text>{((totalWeightedContribution / totalWeight) * 100).toFixed(2)}%</Text></View>
            <View style={[styles.tableCol, { flex: 1.5, textAlign: "right" }]}><Text>{totalWeightedContribution.toFixed(2)}%</Text></View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text>Dibuat Oleh,</Text>
            <View style={styles.signatureLine} />
            <Text>Engineering Divisi</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Mengetahui,</Text>
            <View style={styles.signatureLine} />
            <Text>PPIC</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Menyetujui,</Text>
            <View style={styles.signatureLine} />
            <Text>Project Manager</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

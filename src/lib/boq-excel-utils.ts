import * as XLSX from "xlsx";
import { BoQItemDisplay } from "@/components/trackers/boq-manager-dialog";

/**
 * Downloads a pre-formatted Excel template for importing BoQ items.
 * Includes a clean template sheet and a reference sheet containing active Master Data items.
 */
export function downloadBoQTemplate(masterItems: any[] = []) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template BoQ (Clean header only)
  const templateHeader = [
    "Kode Barang (Opsional)",
    "Nama Barang (*Wajib)",
    "Kuantitas (*Wajib)",
    "Satuan (Opsional)",
    "Harga Satuan (Rp)",
    "Catatan (Opsional)",
  ];

  const wsTemplateData = [templateHeader];
  const wsTemplate = XLSX.utils.aoa_to_sheet(wsTemplateData);

  // Set column widths for Template Sheet
  wsTemplate["!cols"] = [
    { wch: 22 }, // Kode
    { wch: 35 }, // Nama
    { wch: 18 }, // Kuantitas
    { wch: 18 }, // Satuan
    { wch: 20 }, // Harga Satuan
    { wch: 30 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, wsTemplate, "Template BoQ");

  // Sheet 2: Master Data Items (Reference Sheet)
  const masterHeader = ["Kode Barang", "Nama Barang", "Satuan Stok", "Tipe / Merk"];
  const masterRows = masterItems.map((item) => [
    item.code || "-",
    item.name || "-",
    (item.unit?.name || item.unit || "pcs").toLowerCase(),
    item.typeMerk || "-",
  ]);

  const wsMasterData = [masterHeader, ...masterRows];
  const wsMaster = XLSX.utils.aoa_to_sheet(wsMasterData);

  wsMaster["!cols"] = [
    { wch: 20 },
    { wch: 35 },
    { wch: 15 },
    { wch: 25 },
  ];

  XLSX.utils.book_append_sheet(wb, wsMaster, "Master Barang Stock");

  // Export to .xlsx
  XLSX.writeFile(wb, "Template_Input_BoQ.xlsx");
}

export interface SmartImportCandidate {
  item: any;
  score: number; // 0-100
  reason: string;
}

export interface SmartExcelRow {
  rowNumber: number;
  rawCode: string;
  rawName: string;
  rawType: string;
  qty: number;
  unit: string;
  price: number;
  note: string;
  selectedItem: any | null;
  confidence: number; // 0-100
  matchStatus: "EXACT" | "SUGGESTED" | "UNMATCHED";
  matchReason: string;
  candidates: SmartImportCandidate[];
}

export interface ParseExcelResult {
  rows: SmartExcelRow[];
  exactCount: number;
  suggestedCount: number;
  unmatchedCount: number;
  errors: string[];
}

/**
 * Text normalization helper
 */
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate string similarity score (0 - 100) using Token Intersection + Levenshtein Distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  // 1. Token Intersection Score (Dice coefficient)
  const tokens1 = new Set(norm1.split(" "));
  const tokens2 = new Set(norm2.split(" "));

  let commonCount = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) commonCount++;
  });

  const tokenScore =
    (2 * commonCount) / (tokens1.size + tokens2.size) * 100;

  // 2. Substring containment boost
  let containmentBonus = 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    containmentBonus = 20;
  }

  const finalScore = Math.min(100, Math.round(tokenScore * 0.8 + containmentBonus));
  return finalScore;
}

/**
 * Robust Price Parser for Excel inputs (supports "Rp. 120.000", "120.000,00", "120000", "Rp 150.000", etc.)
 */
export function parsePriceValue(raw: any): number {
  if (raw === null || raw === undefined || raw === "") return 0;

  if (typeof raw === "number") {
    return isNaN(raw) || raw < 0 ? 0 : raw;
  }

  const str = String(raw).trim();
  if (!str) return 0;

  // Simple number string e.g. "100000" or "100000.5"
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    return isNaN(num) || num < 0 ? 0 : num;
  }

  // Remove currency prefix/suffix e.g. "Rp.", "Rp", "IDR", ",00", ",-"
  let cleaned = str
    .replace(/rp\.?/gi, "")
    .replace(/idr/gi, "")
    .trim()
    .replace(/,00$/, "")
    .replace(/,-$/, "");

  // If thousand separators with dots e.g. "120.000" or "1.500.000"
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    const digits = cleaned.replace(/\./g, "");
    const num = parseInt(digits, 10);
    return isNaN(num) || num < 0 ? 0 : num;
  }

  // If Indonesian decimal with comma e.g. "120000,50" or "120.000,50"
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalized);
    return isNaN(num) || num < 0 ? 0 : num;
  }

  // Fallback: extract digits only
  const digitsOnly = cleaned.replace(/[^0-9]/g, "");
  if (digitsOnly) {
    const num = parseInt(digitsOnly, 10);
    return isNaN(num) || num < 0 ? 0 : num;
  }

  return 0;
}

/**
 * Robust Quantity & Unit Extractor from Excel inputs (e.g. "100 pcs", "50", "100.5")
 */
export function parseQtyAndUnit(rawQty: any, rawUnit: any): { qty: number; unit: string } {
  let qty = 0;
  let unit = String(rawUnit || "").trim().toLowerCase();

  if (typeof rawQty === "number") {
    qty = isNaN(rawQty) || rawQty < 0 ? 0 : rawQty;
  } else {
    const strQty = String(rawQty || "").trim();
    if (strQty) {
      // Extract numeric part (including decimals)
      const numMatch = strQty.match(/^([\d.,]+)/);
      if (numMatch) {
        let numStr = numMatch[1];
        if (numStr.includes(",") && !numStr.includes(".")) {
          numStr = numStr.replace(",", ".");
        } else if (numStr.includes(".")) {
          numStr = numStr.replace(/\./g, "").replace(",", ".");
        }
        qty = parseFloat(numStr) || 0;
      }
      // If unit was not provided separately, try extracting text after numbers
      if (!unit) {
        const textMatch = strQty.replace(/^[\d.,\s]+/, "").trim();
        if (textMatch) {
          unit = textMatch.toLowerCase();
        }
      }
    }
  }

  return { qty, unit };
}

/**
 * Parses an uploaded Excel file (.xlsx, .xls, .csv) and performs Smart Multi-Tier Matching.
 */
export async function parseBoQExcelFile(
  file: File,
  masterItems: any[] = [],
): Promise<ParseExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Select the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse to Array of Arrays (aoa)
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        });

        if (!rows || rows.length <= 1) {
          resolve({
            rows: [],
            exactCount: 0,
            suggestedCount: 0,
            unmatchedCount: 0,
            errors: ["File Excel kosong atau tidak memiliki baris data."],
          });
          return;
        }

        const parsedRows: SmartExcelRow[] = [];
        const errors: string[] = [];
        let exactCount = 0;
        let suggestedCount = 0;
        let unmatchedCount = 0;

        // Determine column indexes from header row (row 0)
        const headerRow = rows[0].map((cell: any) =>
          String(cell).trim().toLowerCase(),
        );

        let codeCol = headerRow.findIndex((h: string) => h.includes("kode"));
        let nameCol = headerRow.findIndex((h: string) => h.includes("nama"));
        let qtyCol = headerRow.findIndex(
          (h: string) => h.includes("kuantitas") || h.includes("qty"),
        );
        let unitCol = headerRow.findIndex(
          (h: string) => h.includes("satuan") || h.includes("unit"),
        );
        let priceCol = headerRow.findIndex(
          (h: string) => h.includes("harga") || h.includes("price"),
        );
        let noteCol = headerRow.findIndex(
          (h: string) => h.includes("catatan") || h.includes("note"),
        );

        // Fallbacks if headers were not matched by keyword
        if (codeCol === -1) codeCol = 0;
        if (nameCol === -1) nameCol = 1;
        if (qtyCol === -1) qtyCol = 2;
        if (unitCol === -1) unitCol = 3;
        if (priceCol === -1) priceCol = 4;
        if (noteCol === -1) noteCol = 5;

        // Iterate data rows starting from row 1
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const rawCode = String(row[codeCol] || "").trim();
          const rawName = String(row[nameCol] || "").trim();
          const rawNote = String(row[noteCol] || "").trim();

          // Skip completely empty rows
          if (!rawCode && !rawName) continue;

          // Parse quantity & unit
          const explicitUnit = String(row[unitCol] || "").trim();
          const { qty: qtyVal, unit: extractedUnit } = parseQtyAndUnit(
            row[qtyCol],
            explicitUnit,
          );

          if (isNaN(qtyVal) || qtyVal <= 0) {
            errors.push(
              `Baris ${i + 1}: Kuantitas (${row[qtyCol]}) tidak valid. Baris diabaikan.`,
            );
            continue;
          }

          // Parse price with robust Rupiah parser
          const priceVal = parsePriceValue(row[priceCol]);

          // SMART MATCHING ENGINE (Multi-Tier)
          let selectedItem: any | null = null;
          let matchStatus: "EXACT" | "SUGGESTED" | "UNMATCHED" = "UNMATCHED";
          let matchReason = "Tidak Ditemukan";
          let confidence = 0;
          const candidates: SmartImportCandidate[] = [];

          // TIER 1: Exact Match by Code
          if (rawCode) {
            const codeMatch = masterItems.find(
              (m) => m.code && m.code.trim().toLowerCase() === rawCode.toLowerCase(),
            );
            if (codeMatch) {
              selectedItem = codeMatch;
              matchStatus = "EXACT";
              matchReason = "Kode Exact";
              confidence = 100;
            }
          }

          // TIER 2: Exact Match by Name + Type
          if (!selectedItem && rawName) {
            const normRawName = normalizeText(rawName);
            const sameNameItems = masterItems.filter(
              (m) => normalizeText(m.name) === normRawName,
            );

            if (sameNameItems.length === 1) {
              selectedItem = sameNameItems[0];
              matchStatus = "EXACT";
              matchReason = "Nama Exact";
              confidence = 100;
            } else if (sameNameItems.length > 1) {
              // Multiple items with same name (e.g. different types)
              matchStatus = "SUGGESTED";
              matchReason = `${sameNameItems.length} Variasi Tipe`;
              confidence = 90;
              sameNameItems.forEach((item) => {
                candidates.push({
                  item,
                  score: 90,
                  reason: item.typeMerk ? `Tipe: ${item.typeMerk}` : "Nama Sesuai",
                });
              });
              selectedItem = sameNameItems[0]; // pick first as default suggestion
            }
          }

          // TIER 3: Fuzzy Match by Name Similarity
          if (!selectedItem && rawName) {
            const scored = masterItems
              .map((m) => {
                const nameScore = calculateSimilarity(rawName, m.name || "");
                return {
                  item: m,
                  score: nameScore,
                  reason: `${nameScore}% Mirip`,
                };
              })
              .filter((c) => c.score >= 50)
              .sort((a, b) => b.score - a.score);

            if (scored.length > 0) {
              const top = scored[0];
              if (top.score >= 80) {
                selectedItem = top.item;
                matchStatus = "EXACT";
                matchReason = `${top.score}% Mirip`;
                confidence = top.score;
              } else {
                selectedItem = top.item; // default suggestion
                matchStatus = "SUGGESTED";
                matchReason = `${top.score}% Mirip`;
                confidence = top.score;
              }
              candidates.push(...scored.slice(0, 5));
            }
          }

          // Summary counters
          if (matchStatus === "EXACT") exactCount++;
          else if (matchStatus === "SUGGESTED") suggestedCount++;
          else unmatchedCount++;

          const defaultUnit = extractedUnit || (selectedItem
            ? (selectedItem.unit?.name || selectedItem.unit || "pcs").toLowerCase()
            : "pcs");

          parsedRows.push({
            rowNumber: i + 1,
            rawCode,
            rawName,
            rawType: "",
            qty: qtyVal,
            unit: defaultUnit,
            price: priceVal,
            note: rawNote,
            selectedItem,
            confidence,
            matchStatus,
            matchReason,
            candidates,
          });
        }

        resolve({
          rows: parsedRows,
          exactCount,
          suggestedCount,
          unmatchedCount,
          errors,
        });
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Gagal membaca file Excel."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * src/lib/error-handler.ts
 * Utilitas pembersih dan penerjemah pesan error untuk menghasilkan pesan yang ramah pengguna,
 * ringkas, dan rasional dalam Bahasa Indonesia, serta mencegah bocornya stack trace / kode teknis panjang.
 */

/**
 * Membersihkan pesan error teknis dari Prisma, Database, Network, Stack Trace,
 * dan mengembalikannya dalam kalimat Bahasa Indonesia yang sopan, ringkas, dan rasional.
 */
export function sanitizeErrorMessage(
  error: unknown,
  fallbackMessage = "Terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi."
): string {
  if (!error) return fallbackMessage;

  // 1. Dapatkan teks error mentah dan meta bila ada
  let raw = "";
  let prismaCode: string | undefined = undefined;
  let prismaTarget: string | undefined = undefined;

  if (typeof error === "string") {
    raw = error;
  } else if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, any>;
    if (typeof errObj.code === "string") {
      prismaCode = errObj.code;
    }
    if (errObj.meta) {
      if (typeof errObj.meta.code === "string") {
        prismaCode = errObj.meta.code;
      }
      if (errObj.meta.target) {
        prismaTarget = Array.isArray(errObj.meta.target)
          ? errObj.meta.target.join(", ")
          : String(errObj.meta.target);
      }
    }
    raw = errObj.message || errObj.error || String(error);
  } else {
    raw = String(error);
  }

  // 2. Evaluasi berdasarkan Prisma Error Codes resmi
  if (prismaCode) {
    switch (prismaCode) {
      case "P2002":
        return prismaTarget
          ? `Data '${prismaTarget}' sudah terdaftar. Mohon gunakan nilai yang berbeda.`
          : "Data tersebut sudah terdaftar di sistem. Mohon gunakan data atau kode yang unik.";
      case "P2025":
        return "Data yang diminta tidak ditemukan atau sudah dihapus dari sistem.";
      case "P2003":
        return "Operasi gagal karena data ini masih terkait dengan data lain yang aktif.";
      case "P2014":
        return "Perubahan gagal karena relasi data yang dibutuhkan belum terpenuhi.";
      case "P2000":
        return "Nilai data yang dimasukkan melebihi batas panjang karakter yang diizinkan.";
      case "P1001":
      case "P1002":
      case "P1008":
      case "P1017":
        return "Gagal terhubung ke database. Silakan periksa koneksi server atau coba lagi.";
      default:
        break;
    }
  }

  const trimmed = raw.trim();

  // 3. Deteksi pola teks Prisma error yang tersimpan dalam message
  if (
    trimmed.includes("Unique constraint failed") ||
    trimmed.includes("P2002")
  ) {
    return "Data tersebut sudah terdaftar di sistem. Mohon gunakan data atau kode yang unik.";
  }
  if (
    trimmed.includes("Record to update not found") ||
    trimmed.includes("Record to delete does not exist") ||
    trimmed.includes("An operation failed because it depends on one or more records that were required but not found") ||
    trimmed.includes("P2025")
  ) {
    return "Data yang diminta tidak ditemukan atau sudah dihapus dari sistem.";
  }
  if (
    trimmed.includes("Foreign key constraint failed") ||
    trimmed.includes("P2003")
  ) {
    return "Operasi tidak dapat dilakukan karena data ini masih terkait dengan data lain.";
  }
  if (
    trimmed.includes("Invalid `prisma.") ||
    trimmed.includes("PrismaClient") ||
    trimmed.includes("prisma-client")
  ) {
    return fallbackMessage || "Terjadi kesalahan saat memproses data ke database.";
  }

  // 4. Deteksi pola Network / Jaringan
  if (
    trimmed.includes("fetch failed") ||
    trimmed.includes("Failed to fetch") ||
    trimmed.includes("NetworkError") ||
    trimmed.includes("ECONNREFUSED") ||
    trimmed.includes("ETIMEDOUT") ||
    trimmed.includes("ENOTFOUND") ||
    trimmed.includes("network timeout")
  ) {
    return "Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.";
  }

  // 5. Deteksi pola respons server rusak / JSON parse
  if (
    trimmed.includes("Unexpected token <") ||
    trimmed.includes("is not valid JSON") ||
    trimmed.includes("JSON.parse")
  ) {
    return "Respons dari server tidak valid. Silakan muat ulang halaman.";
  }

  // 6. Deteksi pola Autentikasi & Hak Akses
  if (
    trimmed.toLowerCase().includes("unauthorized") ||
    trimmed.toLowerCase().includes("jwt expired") ||
    trimmed.toLowerCase().includes("session expired")
  ) {
    return "Sesi login Anda telah berakhir atau Anda belum login.";
  }
  if (
    trimmed.toLowerCase().includes("forbidden") ||
    trimmed.toLowerCase().includes("tidak memiliki hak akses") ||
    trimmed.toLowerCase().includes("hanya divisi")
  ) {
    // Jika pesan sudah spesifik menyebut divisi yang diizinkan, gunakan baris pertama
    const firstLine = trimmed.split("\n")[0].replace(/^Error:\s*/i, "").trim();
    if (firstLine.length > 5 && firstLine.length <= 120) {
      return firstLine;
    }
    return "Anda tidak memiliki hak akses untuk melakukan tindakan ini.";
  }

  // 7. Deteksi pola File & Storage
  if (
    trimmed.includes("Payload too large") ||
    trimmed.includes("File too large") ||
    trimmed.includes("413")
  ) {
    return "Ukuran file terlalu besar. Mohon unggah file dengan ukuran yang lebih kecil.";
  }

  // 8. Deteksi jika teks mengandung Stack Trace, baris kode, atau path file
  if (
    trimmed.includes("\n") ||
    trimmed.includes("at ") ||
    trimmed.includes(".ts:") ||
    trimmed.includes(".js:") ||
    /d:[\\\/]|c:[\\\/]/i.test(trimmed)
  ) {
    const firstLine = trimmed.split("\n")[0].replace(/^Error:\s*/i, "").trim();
    // Jika baris pertama adalah kalimat penjelasan ringkas tanpa metadata teknis
    if (
      firstLine.length > 5 &&
      firstLine.length <= 110 &&
      !firstLine.includes("at ") &&
      !firstLine.includes("prisma") &&
      !firstLine.includes("node_modules") &&
      !/d:[\\\/]|c:[\\\/]/i.test(firstLine) &&
      !firstLine.includes("{")
    ) {
      return firstLine;
    }
    return fallbackMessage;
  }

  // 9. Jika pesan terlalu panjang (> 130 karakter) dan kemungkinan teks teknis
  if (trimmed.length > 130) {
    return fallbackMessage;
  }

  // 10. Jika pesan berupa string bersih, hilangkan prefix 'Error: ' bila ada
  const cleanMessage = trimmed.replace(/^Error:\s*/i, "").trim();
  return cleanMessage || fallbackMessage;
}

/**
 * Helper untuk standarisasi return error object pada Server Actions.
 */
export function formatActionError(error: unknown, fallbackMessage: string) {
  return {
    success: false as const,
    error: sanitizeErrorMessage(error, fallbackMessage),
  };
}

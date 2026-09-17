import fs from "fs";
import path from "path";

/**
 * Script Pemeriksaan Integritas Konfigurasi Autentikasi (NextAuth v5)
 * Dijalankan sebelum build / deployment untuk mencegah bug fatal di production.
 */
function verifyAuthIntegrity() {
  console.log("🔍 Menjalankan verifikasi integritas konfigurasi autentikasi...");
  const errors: string[] = [];

  // 1. Verifikasi route handler [...nextauth]/route.ts
  const routePath = path.join(
    process.cwd(),
    "src",
    "app",
    "api",
    "auth",
    "[...nextauth]",
    "route.ts"
  );

  if (!fs.existsSync(routePath)) {
    errors.push(
      `File route handler auth tidak ditemukan di: ${routePath}`
    );
  } else {
    const routeContent = fs.readFileSync(routePath, "utf-8");

    // Periksa apakah dibungkus manual ke async function kustom (Penyebab bug 404 NextAuth)
    if (
      routeContent.includes("export async function GET") ||
      routeContent.includes("export async function POST")
    ) {
      errors.push(
        "FATAL: Route handler [...nextauth]/route.ts dibungkus dalam custom async function!\n" +
        "   Di Next.js 15/16 App Router, handlers bawaan harus di-export langsung:\n" +
        "   export const { GET, POST } = handlers;\n" +
        "   Membungkusnya manual akan menghilangkan context params dan menyebabkan 404 pada /api/auth/session."
      );
    }

    if (
      !routeContent.includes("handlers") &&
      !routeContent.includes("export { GET, POST }")
    ) {
      errors.push(
        "FATAL: Route handler [...nextauth]/route.ts tidak mengekspor GET dan POST dari auth handlers."
      );
    }
  }

  // 2. Verifikasi keberadaan halaman login
  const loginPath = path.join(
    process.cwd(),
    "src",
    "app",
    "(auth)",
    "login",
    "page.tsx"
  );
  if (!fs.existsSync(loginPath)) {
    errors.push(
      `File halaman login tidak ditemukan di: ${loginPath}`
    );
  }

  // 3. Verifikasi Secret Key
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!authSecret) {
    // Coba baca dari file .env jika dijalankan di lokal
    const envPath = path.join(process.cwd(), ".env");
    let hasEnvSecret = false;
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      if (
        envContent.includes("AUTH_SECRET=") ||
        envContent.includes("NEXTAUTH_SECRET=")
      ) {
        hasEnvSecret = true;
      }
    }

    if (!hasEnvSecret) {
      errors.push(
        "Peringatan/Error: AUTH_SECRET atau NEXTAUTH_SECRET belum didefinisikan di environment variables!"
      );
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ GAGAL VERIFIKASI AUTENTIKASI:");
    errors.forEach((err, idx) => {
      console.error(`  ${idx + 1}. ${err}`);
    });
    console.error("\nProses build dibatalkan untuk mencegah regresi bug di production.\n");
    process.exit(1);
  }

  console.log("✅ Integritas autentikasi valid & aman.");
}

verifyAuthIntegrity();

# Project Notes & Reminders

## Architectural Invariants & Production Safety

### 1. Authentication (NextAuth v5 / Auth.js)
- **Route Handler Invariant**: `src/app/api/auth/[...nextauth]/route.ts` MUST always export `export const { GET, POST } = handlers;` directly from `@/auth`.
  - **DILARANG** membungkus `GET` atau `POST` ke dalam custom async function (misal: `export async function GET(req) { return handlers.GET(req); }`). Di Next.js App Router (Next 15/16), pembungkusan manual akan menghilangkan parameter konteks `context.params` sehingga semua endpoint auth (`/api/auth/session`, `/api/auth/csrf`, dll.) mengembalikan status 404 (Not Found) dan menyebabkan crash parsing JSON di browser (`ClientFetchError: Unexpected token '<'`).
- **Environment Variables**: Selalu pastikan `AUTH_SECRET` atau `NEXTAUTH_SECRET` tersedia di `.env` (development) dan di dashboard environment production (Vercel/Railway/VPS).
- **Automated Verification**: Jalankan `npm run verify:auth` atau `npm run build` untuk memvalidasi integritas konfigurasi auth sebelum deployment.

### 2. Next.js 16 Dynamic Routes & Middleware
- Di Next.js 15+, dynamic route `params` dan `searchParams` bersifat asinkron (`Promise`).
- Rute-rute publik seperti `/login`, `/api/auth`, dan `/api/warehouse` harus selalu di-bypass pada `middleware.ts` agar tidak terjadi infinite redirect loop.
- Jangan gunakan `prisma db pull`. Skema database dikelola melalui migrasi terarah di direktori `prisma/migrations`.

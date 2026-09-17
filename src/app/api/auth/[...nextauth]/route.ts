import { handlers } from "@/auth";

/**
 * PENTING (ATURAN NEXTAUTH V5 DI NEXT.JS APP ROUTER):
 * JANGAN PERNAH membungkus `handlers.GET` atau `handlers.POST` ke dalam custom async function!
 * Di Next.js App Router (Next 15/16), route catch-all `[...nextauth]` membutuhkan handler
 * asli yang menerima `(request, context)`.
 * Membungkusnya secara manual akan menghilangkan context params dinamis Next.js
 * dan menyebabkan error 404 (Not Found) pada semua sub-rute (/session, /csrf, dll).
 */
export const { GET, POST } = handlers;


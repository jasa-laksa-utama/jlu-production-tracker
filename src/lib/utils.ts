import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes input to prevent XSS by escaping special characters.
 */
export function sanitizeInput(value: string): string {
  if (typeof value !== "string") return value;
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats a number or string into Indonesian Rupiah currency format.
 * (Display only)
 */
export function formatRupiah(amount: number | string): string {
  const numericValue = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numericValue)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/**
 * Normalizes email format (lowercase and trimmed).
 */
export function formatEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Standardizes phone number format.
 * Cleans non-numeric characters and ensures consistent prefix if needed.
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  // If it starts with 0, replace with +62 (optional based on user preference)
  // For now, just clean it up to keep it as digits
  return cleaned;
}

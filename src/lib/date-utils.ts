/**
 * Central Date & Timezone Utilities for GMT+7 (Asia/Jakarta / WIB)
 */

if (typeof process !== "undefined" && process.env) {
  process.env.TZ = "Asia/Jakarta";
}

/**
 * Returns current Date object in Asia/Jakarta timezone
 */
export function getJakartaDate(): Date {
  const now = new Date();
  const jakartaStr = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  return new Date(jakartaStr);
}

/**
 * Formats any Date object, ISO string, or timestamp into Asia/Jakarta (WIB) time.
 */
export function formatJakartaDate(
  dateInput: Date | string | number | null | undefined,
  pattern: "date" | "datetime" | "time" | "full" | "short" | string = "datetime"
): string {
  if (!dateInput) return "-";
  const date =
    typeof dateInput === "string" || typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput;

  if (isNaN(date.getTime())) return "-";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Jakarta",
  };

  if (
    pattern === "date" ||
    pattern === "dd MMM yyyy" ||
    pattern === "dd MMMM yyyy" ||
    pattern === "dd MMM yy"
  ) {
    options.day = "2-digit";
    options.month = "short";
    options.year = "numeric";
    return new Intl.DateTimeFormat("id-ID", options).format(date);
  }

  if (
    pattern === "short" ||
    pattern === "dd/MM/yy" ||
    pattern === "dd/MM/yyyy"
  ) {
    options.day = "2-digit";
    options.month = "2-digit";
    options.year = "2-digit";
    return new Intl.DateTimeFormat("id-ID", options).format(date);
  }

  if (
    pattern === "datetime" ||
    pattern === "dd MMM yyyy, HH:mm" ||
    pattern === "dd/MM/yy HH:mm" ||
    pattern === "dd MMM, HH:mm"
  ) {
    options.day = "2-digit";
    options.month = "short";
    options.year = "numeric";
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = false;
    return new Intl.DateTimeFormat("id-ID", options).format(date);
  }

  if (pattern === "time" || pattern === "HH:mm:ss" || pattern === "HH:mm") {
    options.hour = "2-digit";
    options.minute = "2-digit";
    if (pattern === "HH:mm:ss" || pattern === "time") options.second = "2-digit";
    options.hour12 = false;
    return new Intl.DateTimeFormat("id-ID", options).format(date);
  }

  if (pattern === "full" || pattern.includes("EEEE")) {
    options.weekday = "long";
    options.day = "numeric";
    options.month = "long";
    options.year = "numeric";
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = false;
    return new Intl.DateTimeFormat("id-ID", options).format(date);
  }

  options.day = "2-digit";
  options.month = "short";
  options.year = "numeric";
  return new Intl.DateTimeFormat("id-ID", options).format(date);
}

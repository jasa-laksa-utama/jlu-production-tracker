import { auth } from "@/auth";

/**
 * Ensures the user is logged in. Returns the session user object if valid,
 * otherwise throws an error.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error("Unauthorized: Anda harus login terlebih dahulu.");
  }
  return session.user;
}

/**
 * Ensures the user is logged in and has at least one of the allowed roles.
 */
export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth();
  const userRoles = user.roles || [];
  const hasRole = userRoles.some((role) => allowedRoles.includes(role));
  if (!hasRole) {
    throw new Error("Forbidden: Anda tidak memiliki hak akses untuk tindakan ini.");
  }
  return user;
}

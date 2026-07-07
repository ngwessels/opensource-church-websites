/**
 * @param {string | undefined | null} email
 * @returns {string | undefined}
 */
export function normalizeDonorEmail(email) {
  if (!email || typeof email !== "string") return undefined;
  const trimmed = email.trim().toLowerCase();
  return trimmed || undefined;
}

/** @typedef {import("@/types/firestore").UserRole} UserRole */

/** @type {readonly UserRole[]} */
export const USER_ROLES = ["admin", "finance", "member"];

/**
 * @param {unknown} value
 * @returns {UserRole}
 */
export function normalizeUserRole(value) {
  if (value === "admin" || value === "finance" || value === "member") {
    return value;
  }
  return "member";
}

/** @param {unknown} role @returns {boolean} */
export function isAdminRole(role) {
  return role === "admin";
}

/** @param {unknown} role @returns {boolean} */
export function isFinanceRole(role) {
  return role === "finance";
}

/** @param {unknown} role @returns {boolean} */
export function canAccessBuilder(role) {
  return isAdminRole(role) || isFinanceRole(role);
}

/** @param {unknown} role @returns {boolean} */
export function canManageDonations(role) {
  return canAccessBuilder(role);
}

/** @param {unknown} role @returns {string} */
export function getBuilderHomeHref(role) {
  if (isFinanceRole(role)) return "/builder/donations";
  if (isAdminRole(role)) return "/builder/edit";
  return "/login?error=admin_required";
}

/** @param {unknown} role @returns {string} */
export function formatUserRoleLabel(role) {
  const normalized = normalizeUserRole(role);
  if (normalized === "admin") return "Admin";
  if (normalized === "finance") return "Finance";
  return "Member";
}

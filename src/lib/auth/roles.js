/** @typedef {import("@/types/firestore").UserRole} UserRole */

/** @type {readonly UserRole[]} */
export const USER_ROLES = ["admin", "finance", "member", "donor"];

/**
 * @param {unknown} value
 * @returns {UserRole}
 */
export function normalizeUserRole(value) {
  if (value === "admin" || value === "finance" || value === "member" || value === "donor") {
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

/** @param {unknown} role @returns {boolean} */
export function isDonorRole(role) {
  return role === "donor";
}

/** @param {unknown} role @returns {boolean} */
export function canAccessDonorPortal(role) {
  return isDonorRole(role) || isAdminRole(role) || isFinanceRole(role);
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
  if (normalized === "donor") return "Donor";
  return "Member";
}

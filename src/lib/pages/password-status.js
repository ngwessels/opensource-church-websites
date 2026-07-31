/**
 * Client-safe helpers for password-protected CMS pages (no Node crypto).
 */

import { isHomePage } from "./visibility.js";

export const MIN_PASSWORD_LENGTH = 4;

/**
 * @param {{ passwordProtected?: boolean, passwordHash?: string } | null | undefined} page
 */
export function isPagePasswordProtected(page) {
  return (
    page?.passwordProtected === true &&
    typeof page?.passwordHash === "string" &&
    page.passwordHash.length > 0
  );
}

/**
 * @param {{ slug?: string } | null | undefined} page
 * @param {boolean} passwordProtected
 */
export function wouldProtectHomePage(page, passwordProtected) {
  return passwordProtected === true && isHomePage(page);
}

/**
 * @param {unknown} password
 * @returns {string}
 */
export function normalizePagePasswordInput(password) {
  if (typeof password !== "string") {
    throw new Error("Password is required");
  }
  const trimmed = password.trim();
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * Remove password hash before sending page data to the browser.
 * @template {Record<string, unknown>} T
 * @param {T | null | undefined} page
 * @returns {Omit<T, "passwordHash"> | null | undefined}
 */
export function stripPasswordHash(page) {
  if (!page || typeof page !== "object") return page;
  const { passwordHash: _passwordHash, ...rest } = page;
  return rest;
}

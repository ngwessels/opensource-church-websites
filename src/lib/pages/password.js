/**
 * Server-side scrypt hash/verify for password-protected CMS pages.
 */

import { promisify } from "node:util";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { normalizePagePasswordInput } from "./password-status.js";

export {
  isPagePasswordProtected,
  wouldProtectHomePage,
  normalizePagePasswordInput,
  stripPasswordHash,
  MIN_PASSWORD_LENGTH,
} from "./password-status.js";

const scryptAsync = promisify(scrypt);

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPagePassword(password) {
  const normalized = normalizePagePasswordInput(password);
  const salt = randomBytes(SCRYPT_SALT_LEN);
  const hash = /** @type {Buffer} */ (await scryptAsync(normalized, salt, SCRYPT_KEYLEN));
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/**
 * @param {string} password
 * @param {string | null | undefined} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPagePassword(password, stored) {
  if (!stored || typeof stored !== "string" || typeof password !== "string") {
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[1], "base64url");
    expected = Buffer.from(parts[2], "base64url");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;

  const hash = /** @type {Buffer} */ (await scryptAsync(password.trim(), salt, expected.length));
  const actual = Buffer.from(hash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hashPagePassword,
  isPagePasswordProtected,
  MIN_PASSWORD_LENGTH,
  normalizePagePasswordInput,
  stripPasswordHash,
  verifyPagePassword,
  wouldProtectHomePage,
} from "./password.js";
import {
  PAGE_UNLOCK_COOKIE_NAME,
  buildPageUnlockCookieValue,
  isPageUnlockedInCookie,
  parsePageUnlockCookie,
  serializePageUnlockCookie,
} from "./unlock-cookie.js";

describe("isPagePasswordProtected", () => {
  it("requires both flag and hash", () => {
    assert.equal(isPagePasswordProtected({ passwordProtected: true, passwordHash: "scrypt$a$b" }), true);
    assert.equal(isPagePasswordProtected({ passwordProtected: true }), false);
    assert.equal(isPagePasswordProtected({ passwordProtected: false, passwordHash: "x" }), false);
    assert.equal(isPagePasswordProtected({}), false);
  });
});

describe("wouldProtectHomePage", () => {
  it("blocks protecting the home page", () => {
    assert.equal(wouldProtectHomePage({ slug: "" }, true), true);
    assert.equal(wouldProtectHomePage({ slug: "about" }, true), false);
    assert.equal(wouldProtectHomePage({ slug: "" }, false), false);
  });
});

describe("normalizePagePasswordInput", () => {
  it("rejects short passwords", () => {
    assert.throws(() => normalizePagePasswordInput("ab"), /at least/);
    assert.equal(normalizePagePasswordInput("  abcd  "), "abcd");
    assert.ok(MIN_PASSWORD_LENGTH >= 4);
  });
});

describe("hashPagePassword / verifyPagePassword", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPagePassword("parish-secret");
    assert.match(hash, /^scrypt\$/);
    assert.equal(await verifyPagePassword("parish-secret", hash), true);
    assert.equal(await verifyPagePassword("wrong", hash), false);
    assert.equal(await verifyPagePassword("parish-secret", "not-a-hash"), false);
  });

  it("produces unique salts", async () => {
    const a = await hashPagePassword("same-password");
    const b = await hashPagePassword("same-password");
    assert.notEqual(a, b);
    assert.equal(await verifyPagePassword("same-password", a), true);
    assert.equal(await verifyPagePassword("same-password", b), true);
  });
});

describe("stripPasswordHash", () => {
  it("removes passwordHash from page objects", () => {
    const stripped = stripPasswordHash({
      id: "p1",
      passwordProtected: true,
      passwordHash: "secret-hash",
      title: "Private",
    });
    assert.equal(stripped.passwordHash, undefined);
    assert.equal(stripped.passwordProtected, true);
    assert.equal(stripped.title, "Private");
  });
});

describe("page unlock cookie", () => {
  it("round-trips signed unlock payloads", () => {
    const exp = Date.now() + 60_000;
    const value = serializePageUnlockCookie({ pageIds: ["page_a", "page_b"], exp });
    const parsed = parsePageUnlockCookie(value);
    assert.deepEqual(parsed?.pageIds, ["page_a", "page_b"]);
    assert.equal(parsed?.exp, exp);
    assert.equal(isPageUnlockedInCookie(value, "page_a"), true);
    assert.equal(isPageUnlockedInCookie(value, "page_z"), false);
  });

  it("rejects tampered cookies", () => {
    const value = serializePageUnlockCookie({
      pageIds: ["page_a"],
      exp: Date.now() + 60_000,
    });
    assert.equal(parsePageUnlockCookie(`${value}x`), null);
    assert.equal(parsePageUnlockCookie("not.valid"), null);
  });

  it("rejects expired cookies", () => {
    const value = serializePageUnlockCookie({
      pageIds: ["page_a"],
      exp: Date.now() - 1_000,
    });
    assert.equal(parsePageUnlockCookie(value), null);
  });

  it("merges unlocked page ids", () => {
    const first = buildPageUnlockCookieValue(null, "page_a");
    const second = buildPageUnlockCookieValue(first, "page_b");
    assert.equal(isPageUnlockedInCookie(second, "page_a"), true);
    assert.equal(isPageUnlockedInCookie(second, "page_b"), true);
    assert.equal(PAGE_UNLOCK_COOKIE_NAME, "page_unlock");
  });
});

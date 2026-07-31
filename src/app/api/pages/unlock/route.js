import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { isPagePasswordProtected, verifyPagePassword } from "@/lib/pages/password";
import {
  PAGE_UNLOCK_COOKIE_NAME,
  PAGE_UNLOCK_MAX_AGE_SECONDS,
  buildPageUnlockCookieValue,
  pageUnlockCookieOptions,
} from "@/lib/pages/unlock-cookie";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimitBuckets = new Map();

/**
 * @param {string} key
 */
function checkRateLimit(key) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * POST — { pageId, password } unlock a password-protected public page.
 */
export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    const pageId = typeof body?.pageId === "string" ? body.pageId.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!pageId || !password) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
    }

    const rateKey = `${clientIp(request)}:${pageId}`;
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }

    const db = getFirebaseAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }

    const snap = await db.collection(COLLECTIONS.pages).doc(pageId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
    }

    const page = { id: snap.id, ...snap.data() };
    if (!isPagePasswordProtected(page)) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
    }

    const ok = await verifyPagePassword(password, page.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const cookieStore = await cookies();
    const existing = cookieStore.get(PAGE_UNLOCK_COOKIE_NAME)?.value;
    const value = buildPageUnlockCookieValue(existing, pageId);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      PAGE_UNLOCK_COOKIE_NAME,
      value,
      pageUnlockCookieOptions(PAGE_UNLOCK_MAX_AGE_SECONDS),
    );
    return response;
  } catch (err) {
    console.error("[pages/unlock]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

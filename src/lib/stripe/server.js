import Stripe from "stripe";

let stripe = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local.");
  }

  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripe;
}

export function getAppUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * Join site origin and relative path without a double slash.
 * @param {string} returnPath - Path starting with / (e.g. /giving)
 */
export function joinAppUrl(returnPath) {
  const base = getAppUrl();
  const path =
    typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")
      ? returnPath
      : "/give";
  return new URL(path, `${base}/`).toString();
}

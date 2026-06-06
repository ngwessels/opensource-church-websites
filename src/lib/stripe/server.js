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
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

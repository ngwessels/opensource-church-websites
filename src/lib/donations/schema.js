import { generateId } from "../sitemap/tree.js";

/** @typedef {import('@/types/firestore').DonationFund} DonationFund */
/** @typedef {import('@/types/firestore').DonationCommentsConfig} DonationCommentsConfig */
/** @typedef {import('@/types/firestore').DonationPageConfig} DonationPageConfig */
/** @typedef {import('@/types/firestore').DonorInfo} DonorInfo */
/** @typedef {import('@/types/firestore').DonorAddress} DonorAddress */
/** @typedef {import('@/types/firestore').DonationRecord} DonationRecord */

export const DEFAULT_PRESET_AMOUNTS_CENTS = [2500, 5000, 10000, 50000];

export const DEFAULT_DONATION_FUND = {
  id: "general",
  label: "General Fund",
  description: "",
};

export const DEFAULT_DONATION_COMMENTS = {
  enabled: true,
  label: "Comments",
  placeholder: "",
};

export const DONOR_COMMENT_MAX_LENGTH = 500;

/**
 * Stripe Checkout session options for donor contact collection on the hosted page.
 * Email is always required by Checkout (no separate API flag).
 * Phone is optional when phone_number_collection is enabled.
 * @returns {{ billing_address_collection: "required", phone_number_collection: { enabled: true } }}
 */
export function stripeCheckoutCustomerCollectionOptions() {
  return {
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
  };
}

/**
 * @param {string} label
 * @param {string} [description]
 * @returns {DonationFund}
 */
export function createDonationFund(label, description = "") {
  return {
    id: generateId(),
    label: label.trim(),
    description: description.trim(),
  };
}

/**
 * @param {DonationPageConfig | undefined | null} config
 * @returns {DonationPageConfig}
 */
export function normalizeDonationConfig(config) {
  const funds = Array.isArray(config?.funds)
    ? config.funds
        .filter((fund) => fund && typeof fund.label === "string" && fund.label.trim())
        .map((fund) => ({
          id: fund.id || generateId(),
          label: fund.label.trim(),
          description: (fund.description || "").trim(),
        }))
    : [];

  return {
    title: typeof config?.title === "string" && config.title.trim() ? config.title.trim() : "Give",
    description:
      typeof config?.description === "string" && config.description.trim()
        ? config.description.trim()
        : "Support our parish with a secure online donation.",
    funds: funds.length > 0 ? funds : [{ ...DEFAULT_DONATION_FUND }],
    presetAmountsCents:
      Array.isArray(config?.presetAmountsCents) && config.presetAmountsCents.length > 0
        ? config.presetAmountsCents.filter((n) => typeof n === "number" && n >= 100)
        : DEFAULT_PRESET_AMOUNTS_CENTS,
    comments: normalizeDonationComments(config?.comments),
  };
}

/**
 * @param {Partial<DonationCommentsConfig> | undefined | null} comments
 * @returns {DonationCommentsConfig}
 */
export function normalizeDonationComments(comments) {
  return {
    enabled: comments?.enabled !== false,
    label:
      typeof comments?.label === "string" && comments.label.trim()
        ? comments.label.trim()
        : DEFAULT_DONATION_COMMENTS.label,
    placeholder:
      typeof comments?.placeholder === "string" ? comments.placeholder.trim() : "",
  };
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function sanitizeDonorComment(value) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed.slice(0, DONOR_COMMENT_MAX_LENGTH);
}

/**
 * @param {object} [page]
 * @returns {DonationPageConfig}
 */
export function getDonationConfig(page) {
  return normalizeDonationConfig(page?.donationConfig);
}

/**
 * @param {number[]} cents
 * @returns {string}
 */
export function formatPresetAmountsDollars(cents) {
  return cents.map((c) => String(c / 100)).join(", ");
}

/**
 * @param {string} input
 * @returns {number[]}
 */
export function parsePresetAmountsDollars(input) {
  if (typeof input !== "string" || !input.trim()) {
    return DEFAULT_PRESET_AMOUNTS_CENTS;
  }

  const parsed = input
    .split(",")
    .map((part) => Math.round(parseFloat(part.trim()) * 100))
    .filter((n) => Number.isFinite(n) && n >= 100);

  return parsed.length > 0 ? parsed : DEFAULT_PRESET_AMOUNTS_CENTS;
}

/**
 * @param {DonationPageConfig | undefined | null} config
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateDonationConfig(config) {
  const rawFunds = Array.isArray(config?.funds) ? config.funds : [];
  const withLabels = rawFunds.filter(
    (fund) => fund && typeof fund.label === "string" && fund.label.trim(),
  );

  if (withLabels.length === 0) {
    return { ok: false, error: "Add at least one fund designation." };
  }

  const labels = withLabels.map((f) => f.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return { ok: false, error: "Fund labels must be unique." };
  }

  return { ok: true };
}

/**
 * Sanitize a return path for Stripe redirect URLs (no open redirects).
 * @param {string | undefined | null} path
 * @param {string} [fallback="/give"]
 * @returns {string}
 */
export function sanitizeReturnPath(path, fallback = "/give") {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(path, "http://localhost");
    if (url.hostname !== "localhost") {
      return fallback;
    }
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

/**
 * Build donor info from Stripe Checkout customer_details on checkout.session.completed.
 * @param {object | null | undefined} customerDetails
 * @param {string} [fallbackEmail]
 * @returns {DonorInfo | undefined}
 */
export function donorFromStripeSession(customerDetails, fallbackEmail) {
  const email = customerDetails?.email?.trim() || fallbackEmail?.trim();
  const name = customerDetails?.name?.trim();
  const phone = customerDetails?.phone?.trim();

  if (!email && !name) return undefined;

  /** @type {DonorInfo} */
  const donor = {
    name: name || "—",
    email: email || "",
  };

  if (phone) donor.phone = phone;

  const addr = customerDetails?.address;
  if (addr?.line1) {
    donor.address = {
      line1: addr.line1,
      ...(addr.line2 ? { line2: addr.line2 } : {}),
      city: addr.city || "",
      state: addr.state || "",
      postalCode: addr.postal_code || "",
    };
  }

  return donor;
}

/**
 * Build donor info from a Stripe Customer (subscription renewals).
 * @param {import("stripe").Stripe.Customer | import("stripe").Stripe.DeletedCustomer} customer
 * @returns {DonorInfo | undefined}
 */
export function donorFromStripeCustomer(customer) {
  if (!customer || customer.deleted) return undefined;

  const email = customer.email?.trim();
  const name = customer.name?.trim();
  const phone = customer.phone?.trim();

  if (!email && !name) return undefined;

  /** @type {DonorInfo} */
  const donor = {
    name: name || "—",
    email: email || "",
  };

  if (phone) donor.phone = phone;

  const addr = customer.address;
  if (addr?.line1) {
    donor.address = {
      line1: addr.line1,
      ...(addr.line2 ? { line2: addr.line2 } : {}),
      city: addr.city || "",
      state: addr.state || "",
      postalCode: addr.postal_code || "",
    };
  }

  return donor;
}

/**
 * Legacy helper for donations stored with metadata-based donor fields.
 * @param {Record<string, string | undefined> | null | undefined} metadata
 * @param {object} [sessionDetails]
 * @returns {DonorInfo | undefined}
 */
export function donorFromMetadata(metadata, sessionDetails) {
  const stripeDonor = donorFromStripeSession(
    sessionDetails
      ? {
          email: sessionDetails.email,
          name: sessionDetails.name,
          phone: sessionDetails.phone,
          address: sessionDetails.address,
        }
      : undefined,
  );

  const name = metadata?.donorName?.trim();
  const email = metadata?.donorEmail?.trim();

  if (!name && !email && !stripeDonor) return undefined;

  /** @type {DonorInfo} */
  const donor = stripeDonor || {
    name: name || "—",
    email: email || "",
  };

  if (name) donor.name = name;
  if (email) donor.email = email;

  const phone = metadata?.donorPhone?.trim();
  if (phone) donor.phone = phone;

  const line1 = metadata?.donorAddressLine1?.trim();
  const city = metadata?.donorCity?.trim();
  const state = metadata?.donorState?.trim();
  const postalCode = metadata?.donorPostalCode?.trim();

  if (line1 && city && state && postalCode) {
    donor.address = {
      line1,
      city,
      state,
      postalCode,
      ...(metadata?.donorAddressLine2?.trim()
        ? { line2: metadata.donorAddressLine2.trim() }
        : {}),
    };
  }

  return donor;
}

/**
 * @param {DonorInfo | undefined | null} donor
 * @returns {string}
 */
export function formatDonorAddress(donor) {
  const address = donor?.address;
  if (!address) return "—";

  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
  ].filter(Boolean);

  return parts.join(", ") || "—";
}

/**
 * @param {number} amountCents
 * @param {string} [currency="usd"]
 * @returns {string}
 */
export function formatDonationAmount(amountCents, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((amountCents || 0) / 100);
}

/**
 * @param {string} [frequency]
 * @returns {string}
 */
export function formatDonationFrequency(frequency) {
  if (frequency === "weekly") return "Weekly";
  if (frequency === "monthly") return "Monthly";
  return "One-time";
}

/**
 * @param {string} [iso]
 * @returns {string}
 */
export function formatDonationDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { donorFromStripeCustomer } from "./schema.js";
import { persistDonationFromInvoice } from "./stripe-webhook.js";

describe("donorFromStripeCustomer", () => {
  it("maps Stripe customer fields to donor info", () => {
    const donor = donorFromStripeCustomer({
      id: "cus_123",
      object: "customer",
      email: "jane@example.com",
      name: "Jane Doe",
      phone: "+15551234567",
      address: {
        line1: "123 Main St",
        city: "Portland",
        state: "OR",
        postal_code: "97201",
      },
    });

    assert.equal(donor?.name, "Jane Doe");
    assert.equal(donor?.email, "jane@example.com");
    assert.equal(donor?.address?.postalCode, "97201");
  });

  it("returns undefined for deleted customers", () => {
    assert.equal(donorFromStripeCustomer({ deleted: true, id: "cus_123" }), undefined);
  });
});

describe("persistDonationFromInvoice", () => {
  it("skips non-renewal invoices", async () => {
    const result = await persistDonationFromInvoice(
      /** @type {import("firebase-admin/firestore").Firestore} */ ({}),
      /** @type {import("stripe").Stripe} */ ({}),
      /** @type {import("stripe").Stripe.Invoice} */ ({
        id: "in_123",
        billing_reason: "subscription_create",
        subscription: "sub_123",
      }),
    );

    assert.equal(result.persisted, false);
    assert.equal(result.reason, "not_renewal");
  });

  it("persists subscription renewal invoices", async () => {
    /** @type {Record<string, object>} */
    const docs = {};

    const db = {
      collection: () => ({
        doc: (id) => ({
          get: async () => ({ exists: Boolean(docs[id]) }),
          set: async (data) => {
            docs[id] = data;
          },
        }),
      }),
    };

    const stripe = {
      subscriptions: {
        retrieve: async () => ({
          id: "sub_123",
          metadata: {
            frequency: "weekly",
            fundId: "general",
            fundLabel: "General Fund",
          },
        }),
      },
      customers: {
        retrieve: async () => ({
          id: "cus_123",
          object: "customer",
          email: "jane@example.com",
          name: "Jane Doe",
        }),
      },
      checkout: {
        sessions: {
          list: async () => ({ data: [] }),
        },
      },
    };

    const result = await persistDonationFromInvoice(
      /** @type {import("firebase-admin/firestore").Firestore} */ (db),
      /** @type {import("stripe").Stripe} */ (stripe),
      /** @type {import("stripe").Stripe.Invoice} */ ({
        id: "in_renewal",
        billing_reason: "subscription_cycle",
        subscription: "sub_123",
        customer: "cus_123",
        amount_paid: 2500,
        currency: "usd",
        status_transitions: { paid_at: 1_700_000_000 },
      }),
    );

    assert.equal(result.persisted, true);
    assert.equal(docs.in_renewal.frequency, "weekly");
    assert.equal(docs.in_renewal.amountCents, 2500);
    assert.equal(docs.in_renewal.stripeInvoiceId, "in_renewal");
    assert.equal(docs.in_renewal.stripeSubscriptionId, "sub_123");
  });
});

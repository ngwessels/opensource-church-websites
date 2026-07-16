import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { syncDonationsFromStripe } from "./stripe-sync.js";

describe("syncDonationsFromStripe", () => {
  it("imports missing checkout sessions and renewal invoices", async () => {
    /** @type {Record<string, object>} */
    const docs = {};

    const db = {
      collection: () => ({
        where: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
          get: async () => ({ empty: true, docs: [] }),
        }),
        doc: (id) => ({
          get: async () => ({ exists: Boolean(docs[id]) }),
          set: async (data) => {
            docs[id] = data;
          },
        }),
      }),
    };

    const stripe = {
      checkout: {
        sessions: {
          list: async () => ({
            has_more: false,
            data: [
              {
                id: "cs_paid",
                status: "complete",
                payment_status: "paid",
                amount_total: 5000,
                currency: "usd",
                metadata: { frequency: "once", fundId: "general", fundLabel: "General" },
                customer_details: { email: "a@example.com", name: "Ann" },
              },
              {
                id: "cs_unrelated",
                status: "complete",
                payment_status: "paid",
                amount_total: 100,
                currency: "usd",
                metadata: {},
              },
            ],
          }),
        },
      },
      invoices: {
        list: async () => ({
          has_more: false,
          data: [
            {
              id: "in_renewal",
              billing_reason: "subscription_cycle",
              amount_paid: 500,
              currency: "usd",
              customer: "cus_1",
              parent: {
                type: "subscription_details",
                subscription_details: {
                  subscription: "sub_1",
                  metadata: {
                    frequency: "weekly",
                    fundId: "general",
                    fundLabel: "General",
                  },
                },
              },
              status_transitions: { paid_at: 1_700_000_000 },
            },
            {
              id: "in_create",
              billing_reason: "subscription_create",
              amount_paid: 500,
              currency: "usd",
              parent: {
                type: "subscription_details",
                subscription_details: { subscription: "sub_1" },
              },
            },
          ],
        }),
      },
      subscriptions: {
        retrieve: async (id) => ({
          id,
          status: "active",
          currency: "usd",
          customer: "cus_1",
          metadata: {},
          items: { data: [] },
          cancel_at_period_end: false,
          created: 1_699_000_000,
        }),
      },
      customers: {
        retrieve: async () => ({
          id: "cus_1",
          object: "customer",
          email: "a@example.com",
          name: "Ann",
        }),
      },
    };

    const summary = await syncDonationsFromStripe(
      /** @type {import("firebase-admin/firestore").Firestore} */ (db),
      /** @type {import("stripe").Stripe} */ (stripe),
      { lookbackDays: 30 },
    );

    assert.equal(summary.checkouts.created, 1);
    assert.equal(summary.checkouts.skipped, 1);
    assert.equal(summary.renewals.created, 1);
    assert.equal(summary.renewals.skipped, 1);
    assert.equal(docs.cs_paid.amountCents, 5000);
    assert.equal(docs.in_renewal.amountCents, 500);
    assert.equal(docs.cs_unrelated, undefined);
    assert.equal(docs.in_create, undefined);
  });
});

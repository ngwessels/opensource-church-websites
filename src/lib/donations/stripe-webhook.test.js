import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { donorFromStripeCustomer } from "./schema.js";
import {
  getInvoiceSubscriptionId,
  isSubscriptionPaymentIntent,
  persistDonationFromInvoice,
  persistDonationFromPaymentIntent,
} from "./stripe-webhook.js";

describe("getInvoiceSubscriptionId", () => {
  it("reads legacy top-level subscription id", () => {
    assert.equal(getInvoiceSubscriptionId({ subscription: "sub_legacy" }), "sub_legacy");
  });

  it("reads Basil parent.subscription_details.subscription", () => {
    assert.equal(
      getInvoiceSubscriptionId({
        parent: {
          type: "subscription_details",
          subscription_details: { subscription: "sub_parent" },
        },
      }),
      "sub_parent",
    );
  });

  it("returns undefined when no subscription is present", () => {
    assert.equal(getInvoiceSubscriptionId({ parent: { type: "quote_details" } }), undefined);
  });
});

describe("isSubscriptionPaymentIntent", () => {
  it("detects subscription invoice descriptions", () => {
    assert.equal(
      isSubscriptionPaymentIntent({ description: "Subscription update" }),
      true,
    );
    assert.equal(
      isSubscriptionPaymentIntent({ description: "Subscription creation" }),
      true,
    );
  });

  it("allows one-time payment intents", () => {
    assert.equal(
      isSubscriptionPaymentIntent({ id: "pi_abc", description: "pi_abc" }),
      false,
    );
  });
});

describe("persistDonationFromPaymentIntent", () => {
  it("persists succeeded one-time payment intents", async () => {
    /** @type {Record<string, object>} */
    const docs = {};
    const db = {
      collection: () => ({
        where: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
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
      charges: {
        retrieve: async () => ({
          id: "ch_200",
          status: "succeeded",
          paid: true,
          amount: 20000,
          currency: "usd",
          created: 1_700_000_000,
          description: "pi_200",
          payment_intent: "pi_200",
          billing_details: {
            name: "Lish Donor",
            email: "lish.6@frontier.com",
          },
        }),
      },
      paymentIntents: {
        retrieve: async () => ({
          id: "pi_200",
          status: "succeeded",
          metadata: {},
        }),
      },
    };

    const result = await persistDonationFromPaymentIntent(
      /** @type {import("firebase-admin/firestore").Firestore} */ (db),
      /** @type {import("stripe").Stripe} */ (stripe),
      /** @type {import("stripe").Stripe.PaymentIntent} */ ({
        id: "pi_200",
        status: "succeeded",
        amount: 20000,
        amount_received: 20000,
        currency: "usd",
        created: 1_700_000_000,
        description: "pi_200",
        latest_charge: "ch_200",
        metadata: {},
      }),
    );

    assert.equal(result.persisted, true);
    assert.equal(docs.pi_200.amountCents, 20000);
    assert.equal(docs.pi_200.frequency, "once");
    assert.equal(docs.pi_200.donor.email, "lish.6@frontier.com");
  });

  it("skips subscription payment intents", async () => {
    const result = await persistDonationFromPaymentIntent(
      /** @type {import("firebase-admin/firestore").Firestore} */ ({}),
      /** @type {import("stripe").Stripe} */ ({}),
      /** @type {import("stripe").Stripe.PaymentIntent} */ ({
        id: "pi_sub",
        status: "succeeded",
        description: "Subscription update",
      }),
    );

    assert.equal(result.persisted, false);
    assert.equal(result.reason, "subscription_payment");
  });
});

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
      subscriptions: {
        retrieve: async () => ({
          id: "sub_123",
          status: "active",
          currency: "usd",
          customer: "cus_123",
          metadata: {
            frequency: "weekly",
            fundId: "general",
            fundLabel: "General Fund",
          },
          items: {
            data: [
              {
                id: "si_123",
                price: {
                  unit_amount: 2500,
                  recurring: { interval: "week" },
                  product: "prod_123",
                },
              },
            ],
          },
          current_period_end: 1_700_086_400,
          cancel_at_period_end: false,
          created: 1_699_000_000,
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

  it("persists renewals when subscription id is only on invoice.parent", async () => {
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
      subscriptions: {
        retrieve: async (id) => ({
          id,
          status: "active",
          currency: "usd",
          customer: "cus_123",
          metadata: {
            frequency: "weekly",
            fundId: "general",
            fundLabel: "General Fund",
          },
          items: { data: [] },
          cancel_at_period_end: false,
          created: 1_699_000_000,
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
        id: "in_basil",
        billing_reason: "subscription_cycle",
        customer: "cus_123",
        amount_paid: 500,
        currency: "usd",
        parent: {
          type: "subscription_details",
          subscription_details: {
            subscription: "sub_basil",
            metadata: {
              frequency: "weekly",
              fundId: "general",
              fundLabel: "General Fund",
            },
          },
        },
        status_transitions: { paid_at: 1_700_000_000 },
      }),
    );

    assert.equal(result.persisted, true);
    assert.equal(docs.in_basil.stripeSubscriptionId, "sub_basil");
    assert.equal(docs.in_basil.amountCents, 500);
  });

  it("skips cycle invoices with no resolvable subscription id", async () => {
    const result = await persistDonationFromInvoice(
      /** @type {import("firebase-admin/firestore").Firestore} */ ({}),
      /** @type {import("stripe").Stripe} */ ({}),
      /** @type {import("stripe").Stripe.Invoice} */ ({
        id: "in_orphan",
        billing_reason: "subscription_cycle",
        parent: { type: "quote_details" },
      }),
    );

    assert.equal(result.persisted, false);
    assert.equal(result.reason, "no_subscription");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { syncDonorSubscriptionsFromStripe } from "./sync-subscriptions.js";

function createMemoryFirestore() {
  /** @type {Record<string, Record<string, object>>} */
  const collections = {};

  function docsFor(name) {
    if (!collections[name]) collections[name] = {};
    return collections[name];
  }

  function docRef(collectionName, id) {
    const docs = docsFor(collectionName);
    const ref = {
      id,
      get: async () => ({
        id,
        exists: Boolean(docs[id]),
        data: () => docs[id],
        ref,
      }),
      set: async (data, options = {}) => {
        docs[id] = options.merge ? { ...docs[id], ...data } : { ...data };
      },
    };
    return ref;
  }

  const db = {
    collection(name) {
      return {
        doc: (id) => docRef(name, id),
        where(field, _op, value) {
          return {
            get: async () => {
              const docs = docsFor(name);
              const found = Object.entries(docs)
                .filter(([, data]) => data[field] === value)
                .map(([id]) => ({
                  id,
                  data: () => docs[id],
                  ref: docRef(name, id),
                }));
              return { empty: found.length === 0, docs: found };
            },
          };
        },
      };
    },
  };

  return { db, collections };
}

describe("syncDonorSubscriptionsFromStripe", () => {
  it("imports Stripe subscriptions and attaches the donor uid", async () => {
    const { db, collections } = createMemoryFirestore();
    collections.donations = {
      cs_1: {
        donorEmailNormalized: "jane@example.com",
        stripeCustomerId: "cus_123",
      },
    };
    collections.users = {
      uid_1: { email: "jane@example.com", role: "donor" },
    };

    const stripe = {
      customers: {
        list: async () => ({ data: [{ id: "cus_123", email: "jane@example.com" }] }),
      },
      subscriptions: {
        list: async () => ({
          has_more: false,
          data: [
            {
              id: "sub_weekly",
              status: "active",
              currency: "usd",
              customer: "cus_123",
              metadata: { frequency: "weekly", fundId: "general", fundLabel: "General Fund" },
              items: {
                data: [
                  {
                    id: "si_123",
                    current_period_end: 1_700_086_400,
                    price: {
                      unit_amount: 2500,
                      recurring: { interval: "week" },
                      product: "prod_123",
                    },
                  },
                ],
              },
              cancel_at_period_end: false,
              created: 1_699_000_000,
            },
          ],
        }),
      },
    };

    const result = await syncDonorSubscriptionsFromStripe(
      /** @type {import("firebase-admin/firestore").Firestore} */ (db),
      /** @type {import("stripe").Stripe} */ (stripe),
      { uid: "uid_1", email: "jane@example.com" },
    );

    assert.equal(result.subscriptions.length, 1);
    assert.equal(result.subscriptions[0].id, "sub_weekly");
    assert.equal(collections.subscriptions.sub_weekly.donorUid, "uid_1");
    assert.equal(collections.subscriptions.sub_weekly.status, "active");
    assert.equal(collections.subscriptions.sub_weekly.frequency, "weekly");
    assert.deepEqual(collections.users.uid_1.stripeCustomerIds, ["cus_123"]);
  });

  it("retrieves a subscription id stored on a donation when customer lookup is empty", async () => {
    const { db, collections } = createMemoryFirestore();
    collections.donations = {
      cs_1: {
        donorEmailNormalized: "jane@example.com",
        stripeSubscriptionId: "sub_weekly",
      },
    };
    collections.users = { uid_1: { email: "jane@example.com", role: "donor" } };

    const stripe = {
      customers: {
        list: async () => ({ data: [] }),
      },
      subscriptions: {
        list: async () => ({ has_more: false, data: [] }),
        retrieve: async (id) => ({
          id,
          status: "active",
          currency: "usd",
          customer: "cus_recovered",
          metadata: { frequency: "weekly" },
          items: {
            data: [
              {
                id: "si_123",
                current_period_end: 1_700_086_400,
                price: { unit_amount: 1000, recurring: { interval: "week" }, product: "prod_1" },
              },
            ],
          },
          cancel_at_period_end: false,
          created: 1_699_000_000,
        }),
      },
    };

    const result = await syncDonorSubscriptionsFromStripe(
      /** @type {import("firebase-admin/firestore").Firestore} */ (db),
      /** @type {import("stripe").Stripe} */ (stripe),
      { uid: "uid_1", email: "jane@example.com" },
    );

    assert.equal(result.subscriptions[0].id, "sub_weekly");
    assert.equal(collections.subscriptions.sub_weekly.donorUid, "uid_1");
    assert.ok(result.stripeCustomerIds.includes("cus_recovered"));
  });
});

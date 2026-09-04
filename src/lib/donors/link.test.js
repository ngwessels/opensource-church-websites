import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectStripeCustomerIdsForEmail, linkDonorRecordsByEmail } from "./link.js";

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
      update: async (data) => {
        if (!docs[id]) throw new Error(`No document to update: ${id}`);
        docs[id] = { ...docs[id], ...data };
      },
    };
    return ref;
  }

  function matches(data, field, op, value) {
    if (op === "==") return data[field] === value;
    if (op === "in") return Array.isArray(value) && value.includes(data[field]);
    return false;
  }

  const db = {
    collection(name) {
      return {
        doc: (id) => docRef(name, id),
        where(field, op, value) {
          return {
            get: async () => {
              const docs = docsFor(name);
              const found = Object.entries(docs)
                .filter(([, data]) => matches(data, field, op, value))
                .map(([id]) => {
                  const ref = docRef(name, id);
                  return {
                    id,
                    data: () => docs[id],
                    ref,
                  };
                });
              return { empty: found.length === 0, docs: found };
            },
          };
        },
      };
    },
    batch() {
      /** @type {Array<() => Promise<void>>} */
      const ops = [];
      return {
        update(ref, data) {
          ops.push(() => ref.update(data));
        },
        set(ref, data, options) {
          ops.push(() => ref.set(data, options));
        },
        commit: async () => {
          for (const op of ops) await op();
        },
      };
    },
  };

  return { db, collections };
}

describe("linkDonorRecordsByEmail", () => {
  it("links subscriptions by Stripe customer id and donation subscription id", async () => {
    const { db, collections } = createMemoryFirestore();

    collections.donations = {
      cs_1: {
        donorEmail: "Jane@Example.com",
        donorEmailNormalized: "jane@example.com",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_weekly",
      },
    };
    collections.subscriptions = {
      sub_weekly: {
        stripeCustomerId: "cus_123",
        status: "active",
        amountCents: 2500,
      },
    };
    collections.users = {
      uid_1: { email: "jane@example.com", role: "donor" },
    };

    const customerIds = await linkDonorRecordsByEmail(
      /** @type {import("firebase-admin/firestore").Firestore} */ (db),
      "uid_1",
      "Jane@Example.com",
    );

    assert.deepEqual(customerIds, ["cus_123"]);
    assert.equal(collections.donations.cs_1.donorUid, "uid_1");
    assert.equal(collections.subscriptions.sub_weekly.donorUid, "uid_1");
    assert.equal(collections.subscriptions.sub_weekly.donorEmail, "jane@example.com");
    assert.deepEqual(collections.users.uid_1.stripeCustomerIds, ["cus_123"]);
  });

  it("collects customer ids from normalized donation emails", async () => {
    const { db, collections } = createMemoryFirestore();
    collections.donations = {
      cs_1: {
        donorEmailNormalized: "jane@example.com",
        stripeCustomerId: "cus_abc",
      },
    };

    const ids = await collectStripeCustomerIdsForEmail(
      /** @type {import("firebase-admin/firestore").Firestore} */ (db),
      "Jane@Example.com",
    );

    assert.deepEqual(ids, ["cus_abc"]);
  });
});

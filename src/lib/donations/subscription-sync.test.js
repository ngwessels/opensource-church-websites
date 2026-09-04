import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSubscriptionRecord,
  subscriptionCurrentPeriodEndIso,
} from "./subscription-sync.js";

function makeSubscription(overrides = {}) {
  return {
    id: "sub_weekly",
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
    ...overrides,
  };
}

describe("subscriptionCurrentPeriodEndIso", () => {
  it("reads Basil period end from the subscription item", () => {
    assert.equal(
      subscriptionCurrentPeriodEndIso(makeSubscription()),
      new Date(1_700_086_400 * 1000).toISOString(),
    );
  });

  it("falls back to legacy subscription.current_period_end", () => {
    assert.equal(
      subscriptionCurrentPeriodEndIso(
        makeSubscription({
          current_period_end: 1_800_000_000,
          items: { data: [{ id: "si_123", price: { unit_amount: 1000 } }] },
        }),
      ),
      new Date(1_800_000_000 * 1000).toISOString(),
    );
  });
});

describe("buildSubscriptionRecord", () => {
  it("stores donor fields and item period end", () => {
    const record = buildSubscriptionRecord(makeSubscription(), {
      donorUid: "uid_1",
      donorEmail: "jane@example.com",
    });

    assert.equal(record.donorUid, "uid_1");
    assert.equal(record.donorEmail, "jane@example.com");
    assert.equal(record.frequency, "weekly");
    assert.equal(record.amountCents, 2500);
    assert.equal(record.currentPeriodEnd, new Date(1_700_086_400 * 1000).toISOString());
  });
});

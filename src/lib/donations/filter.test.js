import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeDonationFilters,
  emptyDonationFilters,
  filterDonations,
  getUniqueFundLabels,
  hasActiveDonationFilters,
  parseDollarInputToCents,
  sumDonationAmountCents,
} from "./filter.js";

/** @type {import("./filter.js").DonationRow} */
const baseDonation = {
  id: "don-1",
  amountCents: 5000,
  currency: "usd",
  frequency: "once",
  status: "completed",
  fundLabel: "General Fund",
  donorComment: "For the roof",
  createdAt: "2026-06-29T19:35:00.000Z",
  donor: {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "555-1234",
    address: {
      line1: "123 Main St",
      city: "Portland",
      state: "OR",
      postalCode: "97201",
    },
  },
};

describe("donations/filter", () => {
  it("emptyDonationFilters returns defaults", () => {
    const filters = emptyDonationFilters();
    assert.equal(filters.personQuery, "");
    assert.equal(filters.giftType, "all");
    assert.equal(hasActiveDonationFilters(filters), false);
  });

  it("filters by person query across donor fields", () => {
    const filters = { ...emptyDonationFilters(), personQuery: "jane@example" };
    assert.equal(filterDonations([baseDonation], filters).length, 1);

    const noMatch = { ...emptyDonationFilters(), personQuery: "bob" };
    assert.equal(filterDonations([baseDonation], noMatch).length, 0);
  });

  it("filters by date range", () => {
    const inRange = { ...emptyDonationFilters(), dateFrom: "2026-06-29", dateTo: "2026-06-29" };
    assert.equal(filterDonations([baseDonation], inRange).length, 1);

    const outOfRange = { ...emptyDonationFilters(), dateFrom: "2026-07-01" };
    assert.equal(filterDonations([baseDonation], outOfRange).length, 0);
  });

  it("filters by amount range", () => {
    assert.equal(parseDollarInputToCents("50"), 5000);

    const inRange = { ...emptyDonationFilters(), amountMin: "25", amountMax: "100" };
    assert.equal(filterDonations([baseDonation], inRange).length, 1);

    const tooLow = { ...emptyDonationFilters(), amountMin: "100" };
    assert.equal(filterDonations([baseDonation], tooLow).length, 0);
  });

  it("filters by gift type and frequency", () => {
    const recurring = { ...baseDonation, id: "don-2", frequency: "monthly" };

    const oneTime = { ...emptyDonationFilters(), giftType: "one-time" };
    assert.deepEqual(
      filterDonations([baseDonation, recurring], oneTime).map((d) => d.id),
      ["don-1"],
    );

    const recurringFilter = { ...emptyDonationFilters(), giftType: "recurring" };
    assert.deepEqual(
      filterDonations([baseDonation, recurring], recurringFilter).map((d) => d.id),
      ["don-2"],
    );

    const monthly = { ...emptyDonationFilters(), frequency: "monthly" };
    assert.deepEqual(filterDonations([baseDonation, recurring], monthly).map((d) => d.id), [
      "don-2",
    ]);
  });

  it("filters by fund and comments", () => {
    const fund = { ...emptyDonationFilters(), fund: "General Fund" };
    assert.equal(filterDonations([baseDonation], fund).length, 1);

    const hasComment = { ...emptyDonationFilters(), commentFilter: "has" };
    assert.equal(filterDonations([baseDonation], hasComment).length, 1);

    const contains = {
      ...emptyDonationFilters(),
      commentFilter: "contains",
      commentQuery: "roof",
    };
    assert.equal(filterDonations([baseDonation], contains).length, 1);

    const noComment = { ...emptyDonationFilters(), commentFilter: "none" };
    assert.equal(filterDonations([baseDonation], noComment).length, 0);
  });

  it("sums donation amounts", () => {
    const second = { ...baseDonation, id: "don-2", amountCents: 2500 };
    assert.equal(sumDonationAmountCents([baseDonation, second]), 7500);
  });

  it("collects unique fund labels", () => {
    const second = { ...baseDonation, id: "don-2", fundLabel: "Building Fund" };
    assert.deepEqual(getUniqueFundLabels([baseDonation, second]), [
      "Building Fund",
      "General Fund",
    ]);
  });

  it("describes active filters", () => {
    const filters = {
      ...emptyDonationFilters(),
      personQuery: "Jane",
      giftType: "one-time",
    };
    const description = describeDonationFilters(filters);
    assert.match(description, /Person: "Jane"/);
    assert.match(description, /Gift type: One-time/);
  });
});

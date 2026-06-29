"use client";

import { DEFAULT_DONATION_FUND, normalizeDonationConfig } from "@/lib/donations/schema";

import { DonationForm } from "./DonationForm";

/** Standalone donate form for /give with a single default fund. */
export function DonateButton() {
  const comments = normalizeDonationConfig(null).comments;

  return (
    <DonationForm funds={[DEFAULT_DONATION_FUND]} comments={comments} returnPath="/give" />
  );
}

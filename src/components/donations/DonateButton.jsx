"use client";

import { DEFAULT_DONATION_FUND } from "@/lib/donations/schema";

import { DonationForm } from "./DonationForm";

/** Standalone donate form for /give with a single default fund. */
export function DonateButton() {
  return (
    <DonationForm funds={[DEFAULT_DONATION_FUND]} returnPath="/give" />
  );
}

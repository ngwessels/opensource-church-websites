"use client";

import { Suspense } from "react";

import { DonationRegionContent } from "./DonationRegionContent";

/**
 * Standalone donation section (legacy wrapper — prefer DonationRegionContent in page regions).
 * @param {object} props
 * @param {object} props.page
 * @param {string} props.returnPath
 */
export function DonationPageSection({ page, returnPath }) {
  return (
    <section className="site-content-inner mx-auto px-4 py-8">
      <Suspense fallback={null}>
        <DonationRegionContent page={page} returnPath={returnPath} />
      </Suspense>
    </section>
  );
}

"use client";

import { Settings } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { getDonationConfig } from "@/lib/donations/schema";

import { DonationForm } from "./DonationForm";

function DonationStatusBanner() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  if (status === "success") {
    return (
      <div
        role="status"
        className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        Thank you! Your payment has been completed.
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div
        role="status"
        className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Your donation was not completed. You can try again below.
      </div>
    );
  }

  return null;
}

/**
 * Donation form rendered inside a page content region.
 * @param {object} props
 * @param {object} props.page
 * @param {string} props.returnPath
 * @param {boolean} [props.editing]
 * @param {() => void} [props.onEdit]
 */
export function DonationRegionContent({ page, returnPath, editing = false, onEdit }) {
  const config = getDonationConfig(page);

  const formCard = (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">{config.title}</h2>
      <p className="mt-1 text-sm text-zinc-600">{config.description}</p>
      <div className="mt-6">
        <DonationForm
          funds={config.funds}
          presetAmountsCents={config.presetAmountsCents}
          returnPath={returnPath}
        />
      </div>
    </div>
  );

  if (!editing) {
    return (
      <div className="mt-6">
        <Suspense fallback={null}>
          <DonationStatusBanner />
        </Suspense>
        {formCard}
      </div>
    );
  }

  return (
    <div className="group relative mb-6 mt-6 rounded-lg border-l-4 border-l-[var(--admin-accent)] pl-3 ring-1 ring-transparent transition-shadow hover:ring-primary/20">
      <span className="mb-1 inline-block rounded bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Donation form
      </span>
      {onEdit && (
        <div className="absolute -right-2 -top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
            aria-label="Edit donation form"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {formCard}
    </div>
  );
}

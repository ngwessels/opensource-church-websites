"use client";

import { useSearchParams } from "next/navigation";

export function GivePageStatus() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  if (status === "success") {
    return (
      <div
        role="status"
        className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        Thank you! Your payment has been completed.
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div
        role="status"
        className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Your donation was not completed. You can try again below.
      </div>
    );
  }

  return null;
}

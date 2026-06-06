"use client";

import { useState } from "react";

const PRESET_AMOUNTS = [2500, 5000, 10000, 50000];

export function DonateButton() {
  const [amountCents, setAmountCents] = useState(5000);
  const [customAmount, setCustomAmount] = useState("");
  const [frequency, setFrequency] = useState("once");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function formatAmount(cents) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const cents = customAmount
      ? Math.round(parseFloat(customAmount) * 100)
      : amountCents;

    if (!cents || cents < 100) {
      setError("Minimum donation is $1.00.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          frequency,
          email: email || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create checkout session.");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Donation failed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Amount</label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_AMOUNTS.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => {
                setAmountCents(cents);
                setCustomAmount("");
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                amountCents === cents && !customAmount
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {formatAmount(cents)}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="1"
          step="0.01"
          placeholder="Custom amount (USD)"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Frequency</label>
        <div className="mt-2 flex gap-2">
          {["once", "monthly"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFrequency(value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                frequency === value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {value === "once" ? "One-time" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="donor-email" className="block text-sm font-medium text-zinc-700">
          Email (optional)
        </label>
        <input
          id="donor-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Redirecting to checkout…" : "Give now"}
      </button>
    </form>
  );
}

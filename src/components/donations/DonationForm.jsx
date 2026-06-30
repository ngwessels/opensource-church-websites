"use client";

import { useState } from "react";

import { RecaptchaNotice } from "@/components/recaptcha/RecaptchaNotice";
import { useRecaptchaV3 } from "@/hooks/useRecaptchaV3";
import { DEFAULT_DONATION_COMMENTS, DEFAULT_PRESET_AMOUNTS_CENTS, DONOR_COMMENT_MAX_LENGTH } from "@/lib/donations/schema";
import { RECAPTCHA_ACTIONS, RECAPTCHA_TOKEN_FIELD } from "@/lib/recaptcha/constants";

const FREQUENCY_OPTIONS = [
  { value: "once", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * @param {object} props
 * @param {import('@/types/firestore').DonationFund[]} props.funds
 * @param {number[]} [props.presetAmountsCents]
 * @param {import('@/types/firestore').DonationCommentsConfig} [props.comments]
 * @param {string} props.returnPath
 * @param {boolean} [props.disabled]
 */
export function DonationForm({
  funds,
  presetAmountsCents = DEFAULT_PRESET_AMOUNTS_CENTS,
  comments = DEFAULT_DONATION_COMMENTS,
  returnPath,
  disabled = false,
}) {
  const [selectedFundId, setSelectedFundId] = useState(funds[0]?.id ?? "");
  const [amountCents, setAmountCents] = useState(presetAmountsCents[1] ?? presetAmountsCents[0] ?? 5000);
  const [customAmount, setCustomAmount] = useState("");
  const [frequency, setFrequency] = useState("once");
  const [donorComment, setDonorComment] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { enabled: recaptchaEnabled, ready: recaptchaReady, error: recaptchaError, execute: executeRecaptcha } =
    useRecaptchaV3();

  const selectedFund = funds.find((f) => f.id === selectedFundId) ?? funds[0];
  const submitDisabled = loading || disabled || (recaptchaEnabled && !recaptchaReady);

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

    const cents = customAmount ? Math.round(parseFloat(customAmount) * 100) : amountCents;

    if (!cents || cents < 100) {
      setError("Minimum donation is $1.00.");
      setLoading(false);
      return;
    }

    if (!selectedFund?.id || !selectedFund?.label) {
      setError("Please select a fund.");
      setLoading(false);
      return;
    }

    try {
      const trimmedComment = donorComment.trim();
      const recaptchaToken = await executeRecaptcha(RECAPTCHA_ACTIONS.donationCheckout);
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          frequency,
          fundId: selectedFund.id,
          fundLabel: selectedFund.label,
          returnPath,
          ...(trimmedComment ? { donorComment: trimmedComment } : {}),
          ...(recaptchaToken ? { [RECAPTCHA_TOKEN_FIELD]: recaptchaToken } : {}),
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
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {funds.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">Fund designation</label>
          <div className="mt-2 space-y-2">
            {funds.map((fund) => (
              <label
                key={fund.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  selectedFundId === fund.id
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="radio"
                  name="fund"
                  value={fund.id}
                  checked={selectedFundId === fund.id}
                  onChange={() => setSelectedFundId(fund.id)}
                  className="mt-1"
                  disabled={disabled}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-900">{fund.label}</span>
                  {fund.description && (
                    <span className="block text-xs text-zinc-600">{fund.description}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700">Amount</label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presetAmountsCents.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => {
                setAmountCents(cents);
                setCustomAmount("");
              }}
              disabled={disabled}
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
          disabled={disabled}
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Frequency</label>
        <div className="mt-2 flex gap-2">
          {FREQUENCY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFrequency(value)}
              disabled={disabled}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                frequency === value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {comments.enabled && (
        <div>
          <label htmlFor="donor-comment" className="block text-sm font-medium text-zinc-700">
            {comments.label}
          </label>
          <textarea
            id="donor-comment"
            value={donorComment}
            onChange={(e) => setDonorComment(e.target.value)}
            placeholder={comments.placeholder || undefined}
            maxLength={DONOR_COMMENT_MAX_LENGTH}
            rows={3}
            disabled={disabled}
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <p className="text-xs text-zinc-600">
        Email and mailing address are required; phone is optional. All details are collected
        securely on the Stripe checkout page.
      </p>

      {(error || recaptchaError) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? recaptchaError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitDisabled}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading
          ? "Redirecting to checkout…"
          : recaptchaEnabled && !recaptchaReady
            ? "Loading security check…"
            : "Give now"}
      </button>

      <RecaptchaNotice />
    </form>
  );
}

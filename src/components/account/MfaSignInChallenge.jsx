"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMfaRecaptcha } from "@/hooks/useMfaRecaptcha";
import {
  formatMfaError,
  formatPhoneHint,
  isLocalhostPhoneAuthBlocked,
  resolveMfaSignIn,
  startMfaSignIn,
} from "@/lib/firebase/mfa";

const RECAPTCHA_CONTAINER_ID = "mfa-recaptcha-signin";

export function MfaSignInChallenge({ resolver, onSuccess, onCancel }) {
  const { ready, setupError, getVerifier, resetVerifier } = useMfaRecaptcha(
    true,
    RECAPTCHA_CONTAINER_ID,
  );
  const hintIndex = 0;
  const hint = resolver.hints[hintIndex];

  const [verificationId, setVerificationId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  async function handleSendCode() {
    setError(null);

    const verifier = getVerifier();
    if (!verifier) {
      setError("reCAPTCHA is not ready yet. Wait a moment and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const id = await startMfaSignIn(resolver, hintIndex, verifier);
      setVerificationId(id);
      setCodeSent(true);
    } catch (err) {
      setError(formatMfaError(err));
      resetVerifier();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resolveMfaSignIn(resolver, verificationId, code);
      onSuccess();
    } catch (err) {
      setError(formatMfaError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Verify your identity</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the code sent to {formatPhoneHint(hint)} to complete sign-in.
        </p>
      </div>

      {isLocalhostPhoneAuthBlocked() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Phone MFA does not work on <code>localhost</code>. Use{" "}
          <a href="http://127.0.0.1:3000/login" className="font-medium underline">
            http://127.0.0.1:3000
          </a>{" "}
          instead.
        </div>
      )}

      {!codeSent ? (
        <div className="space-y-4">
          <div className="min-h-[78px]">
            <div id={RECAPTCHA_CONTAINER_ID} />
          </div>
          {setupError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{setupError}</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button
            type="button"
            className="w-full"
            disabled={submitting || !ready}
            onClick={handleSendCode}
          >
            {submitting ? "Sending…" : ready ? "Send verification code" : "Loading reCAPTCHA…"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
              Back to sign in
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-signin-code">Verification code</Label>
            <Input
              id="mfa-signin-code"
              type="text"
              inputMode="numeric"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Verifying…" : "Verify and sign in"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting}
            onClick={() => {
              setCodeSent(false);
              setVerificationId(null);
              setCode("");
              setError(null);
              resetVerifier();
            }}
          >
            Resend code
          </Button>
        </form>
      )}
    </div>
  );
}

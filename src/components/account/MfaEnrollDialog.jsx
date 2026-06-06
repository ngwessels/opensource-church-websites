"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMfaRecaptcha } from "@/hooks/useMfaRecaptcha";
import {
  completePhoneEnrollment,
  formatMfaError,
  isLocalhostPhoneAuthBlocked,
  startPhoneEnrollment,
} from "@/lib/firebase/mfa";

const RECAPTCHA_CONTAINER_ID = "mfa-recaptcha-enroll";

export function MfaEnrollDialog({ open, onOpenChange, user, onEnrolled }) {
  const { ready, setupError, getVerifier, resetVerifier } = useMfaRecaptcha(
    open,
    RECAPTCHA_CONTAINER_ID,
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function resetState() {
    setPhoneNumber("");
    setCode("");
    setVerificationId(null);
    setError(null);
    resetVerifier();
  }

  function handleOpenChange(nextOpen) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  async function handleSendCode(event) {
    event.preventDefault();
    setError(null);

    const verifier = getVerifier();
    if (!verifier) {
      setError("reCAPTCHA is not ready yet. Wait a moment and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const id = await startPhoneEnrollment(user, phoneNumber, verifier);
      setVerificationId(id);
    } catch (err) {
      setError(formatMfaError(err));
      resetVerifier();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyAndEnroll(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await completePhoneEnrollment(user, verificationId, code, phoneNumber);
      resetState();
      onEnrolled?.();
      onOpenChange(false);
    } catch (err) {
      setError(formatMfaError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add phone for SMS verification</DialogTitle>
          <DialogDescription>
            Enter your phone number with country code (e.g. +15551234567). Complete the
            reCAPTCHA, then we will send a one-time code.
          </DialogDescription>
        </DialogHeader>

        {isLocalhostPhoneAuthBlocked() && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Phone MFA does not work on <code>localhost</code>. Use{" "}
            <a href="http://127.0.0.1:3000/builder/account" className="font-medium underline">
              http://127.0.0.1:3000
            </a>{" "}
            instead, or configure a test phone number in Firebase Console.
          </div>
        )}

        {!verificationId ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-phone">Phone number</Label>
              <Input
                id="mfa-phone"
                type="tel"
                required
                placeholder="+15551234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="min-h-[78px]">
              <div id={RECAPTCHA_CONTAINER_ID} />
            </div>
            {setupError && <p className="text-sm text-destructive">{setupError}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={submitting || !ready}>
                {submitting ? "Sending…" : ready ? "Send code" : "Loading reCAPTCHA…"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndEnroll} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Verification code</Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setVerificationId(null);
                  setCode("");
                  setError(null);
                  resetVerifier();
                }}
              >
                Change number
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Verifying…" : "Verify and enable"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

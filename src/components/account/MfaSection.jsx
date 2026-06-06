"use client";

import { useState } from "react";

import { MfaEnrollDialog } from "@/components/account/MfaEnrollDialog";
import { ReauthDialog } from "@/components/account/ReauthDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getEnrolledFactors, isLocalhostPhoneAuthBlocked, unenrollFactor } from "@/lib/firebase/mfa";

export function MfaSection() {
  const { user } = useAuth();
  const [factorVersion, setFactorVersion] = useState(0);
  void factorVersion;
  const factors = getEnrolledFactors(user);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function refreshFactors() {
    setFactorVersion((v) => v + 1);
  }

  function handleEnrollClick() {
    setError(null);
    setReauthOpen(true);
  }

  function handleReauthSuccess() {
    setEnrollOpen(true);
  }

  async function handleEnrolled() {
    await user?.reload?.();
    refreshFactors();
  }

  async function handleUnenroll(factorUid) {
    setError(null);
    setSubmitting(true);
    try {
      await unenrollFactor(user, factorUid);
      refreshFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove phone number.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Optionally add an SMS code as a second step when signing in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocalhostPhoneAuthBlocked() && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Phone MFA cannot be tested on <code>localhost</code>. Open{" "}
              <a href="http://127.0.0.1:3000/builder/account" className="font-medium underline">
                http://127.0.0.1:3000
              </a>{" "}
              and add <code>127.0.0.1</code> to Firebase Authorized domains.
            </div>
          )}

          {factors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No phone numbers enrolled for MFA.</p>
          ) : (
            <ul className="space-y-2">
              {factors.map((factor) => (
                <li
                  key={factor.uid}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">SMS</Badge>
                    <span className="text-sm">{factor.displayName || "Phone number"}</span>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={submitting}
                    onClick={() => handleUnenroll(factor.uid)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button type="button" onClick={handleEnrollClick}>
            {factors.length === 0 ? "Add phone number" : "Add another phone"}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <ReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        user={user}
        onSuccess={handleReauthSuccess}
      />
      <MfaEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        user={user}
        onEnrolled={handleEnrolled}
      />
    </>
  );
}

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  hasGoogleProvider,
  hasPasswordProvider,
  reauthenticateEmail,
  reauthenticateGoogle,
} from "@/lib/firebase/mfa";

export function ReauthDialog({ open, onOpenChange, user, onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canUsePassword = hasPasswordProvider(user);
  const canUseGoogle = hasGoogleProvider(user);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      setPassword("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handlePasswordReauth(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await reauthenticateEmail(user, password);
      setPassword("");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reauthentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleReauth() {
    setError(null);
    setSubmitting(true);
    try {
      await reauthenticateGoogle(user);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reauthentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="space-y-1 border-b border-border px-6 pb-4 pt-6 pr-14">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Confirm your identity</DialogTitle>
            <DialogDescription>
              For your security, sign in again before changing account settings.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-6">
          {canUsePassword && (
            <form onSubmit={handlePasswordReauth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reauth-password">Password</Label>
                <Input
                  id="reauth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Verifying…" : "Continue"}
                </Button>
              </div>
            </form>
          )}

          {canUseGoogle && (
            <div className={canUsePassword ? "space-y-4 border-t border-border pt-6" : "space-y-4"}>
              {canUsePassword && (
                <p className="text-center text-xs text-muted-foreground">or</p>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitting}
                onClick={handleGoogleReauth}
              >
                Continue with Google
              </Button>
              {!canUsePassword && error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

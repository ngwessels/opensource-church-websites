"use client";

import { useState } from "react";

import { ReauthDialog } from "@/components/account/ReauthDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { hasPasswordProvider } from "@/lib/firebase/mfa";

export function SecuritySection() {
  const { user, sendPasswordReset, updateUserPassword, sendVerificationEmail } = useAuth();
  const [reauthOpen, setReauthOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canChangePassword = hasPasswordProvider(user);

  async function handleSendReset() {
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(user.email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendVerification() {
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      await sendVerificationEmail();
      setMessage("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await updateUserPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      setMessage("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReauthSuccess() {
    setShowPasswordForm(true);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Password, email verification, and account recovery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!user?.emailVerified && (
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                Your email address is not verified. Verify it to secure your account.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={handleSendVerification}
              >
                Send verification email
              </Button>
            </div>
          )}

          {canChangePassword ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">Change your password or request a reset link.</p>
              {!showPasswordForm ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setReauthOpen(true)}>
                    Change password
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={handleSendReset}
                  >
                    Send reset email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="max-w-sm space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Updating…" : "Update password"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You sign in with Google. Password is managed by your Google account.
            </p>
          )}

          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <ReauthDialog
        open={reauthOpen}
        onOpenChange={setReauthOpen}
        user={user}
        onSuccess={handleReauthSuccess}
      />
    </>
  );
}

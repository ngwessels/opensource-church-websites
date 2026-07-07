"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { formatUserRoleLabel } from "@/lib/auth/roles";

export function ProfileSection({ role }) {
  const { user, updateDisplayName, sendVerificationEmail } = useAuth();
  const [editedName, setEditedName] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const displayName = editedName ?? user?.displayName ?? "";

  async function handleSave(event) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      await updateDisplayName(displayName.trim());
      setEditedName(null);
      setMessage("Display name updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update display name.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResendVerification() {
    setMessage(null);
    setError(null);
    setResendingVerification(true);
    try {
      await sendVerificationEmail();
      setMessage("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification email.");
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account details and role on this site.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-sm text-foreground">{user?.email || "—"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="mb-0">Role</Label>
            <Badge variant={role === "admin" ? "default" : "secondary"}>
              {formatUserRoleLabel(role)}
            </Badge>
            {user?.emailVerified ? (
              <Badge variant="outline">Email verified</Badge>
            ) : (
              <>
                <Badge variant="destructive">Email not verified</Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resendingVerification}
                  onClick={handleResendVerification}
                >
                  {resendingVerification ? "Sending…" : "Resend verification email"}
                </Button>
              </>
            )}
          </div>
          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

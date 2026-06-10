"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function UsersAdmin({ users }) {
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [roleUpdating, setRoleUpdating] = useState(null);

  async function getAuthHeaders() {
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async function handleInvite(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: inviteEmail.trim(),
          displayName: inviteName.trim() || undefined,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");

      if (data.inviteSent) {
        setMessage(`Invitation email sent to ${data.email}.`);
      } else if (data.resetLink) {
        setMessage(`User created. Share this password setup link: ${data.resetLink}`);
      } else if (!data.isNewUser) {
        setMessage(`Updated existing user ${data.email} to ${data.role}.`);
      } else {
        setMessage(`User ${data.email} added as ${data.role}.`);
      }

      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(uid, role) {
    setRoleUpdating(uid);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ uid, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      setMessage(`Role updated to ${role}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setRoleUpdating(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form onSubmit={handleInvite} className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="font-medium text-foreground">Invite user</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@church.org"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send invitation"}
        </Button>
      </form>

      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2">Name</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2">{u.email}</td>
              <td className="py-2 capitalize">{u.role}</td>
              <td className="py-2">{u.displayName}</td>
              <td className="py-2">
                {u.role === "admin" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={roleUpdating === u.id}
                    onClick={() => handleRoleChange(u.id, "member")}
                  >
                    Make member
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={roleUpdating === u.id}
                    onClick={() => handleRoleChange(u.id, "admin")}
                  >
                    Make admin
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-muted-foreground">
        The first account on a new site becomes admin automatically. After that, invite users here.
        Members can sign in but cannot access the builder until promoted to admin.
      </p>
    </div>
  );
}

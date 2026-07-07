"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { formatUserRoleLabel } from "@/lib/auth/roles";
import { getFounderUserId, isFounderUser } from "@/lib/site/founder";

/** @typedef {{ type: "success" | "error", title: string, description?: string, resetLink?: string }} StatusNotice */

export function UsersAdmin({ users }) {
  const { user } = useAuth();
  const founderId = useMemo(() => getFounderUserId(users), [users]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [roleUpdating, setRoleUpdating] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [copied, setCopied] = useState(false);

  async function getAuthHeaders() {
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  function clearStatus() {
    setStatus(null);
    setCopied(false);
  }

  async function copyResetLink(link) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleInvite(event) {
    event.preventDefault();
    setSubmitting(true);
    clearStatus();

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
        setStatus({
          type: "success",
          title: "Invitation sent",
          description: `An email with password setup instructions was sent to ${data.email}.`,
        });
      } else if (data.resetLink) {
        setStatus({
          type: "success",
          title: "User created",
          description: `Share the password setup link below with ${data.email}. Email is not configured on this site, so the link is not sent automatically.`,
          resetLink: data.resetLink,
        });
      } else if (!data.isNewUser) {
        setStatus({
          type: "success",
          title: "User updated",
          description: `${data.email} is now a ${data.role}.`,
        });
      } else {
        setStatus({
          type: "success",
          title: "User added",
          description: `${data.email} was added as ${data.role}.`,
        });
      }

      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
    } catch (err) {
      setStatus({
        type: "error",
        title: "Could not invite user",
        description: err instanceof Error ? err.message : "Failed to invite user",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(target) {
    const label = target.email || target.displayName || "this user";
    if (
      !window.confirm(
        `Remove ${label}? They will lose access to the site and their Firebase sign-in will be deleted.`,
      )
    ) {
      return;
    }

    setRemoving(target.id);
    clearStatus();

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ uid: target.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove user");
      setStatus({
        type: "success",
        title: "User removed",
        description: `${label} no longer has access to this site.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        title: "Could not remove user",
        description: err instanceof Error ? err.message : "Failed to remove user",
      });
    } finally {
      setRemoving(null);
    }
  }

  async function handleRoleChange(uid, role) {
    setRoleUpdating(uid);
    clearStatus();

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ uid, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      setStatus({
        type: "success",
        title: "Role updated",
        description: `User is now a ${role}.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        title: "Could not update role",
        description: err instanceof Error ? err.message : "Failed to update role",
      });
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
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send invitation"}
        </Button>
      </form>

      {status && (
        <StatusNotice
          status={status}
          copied={copied}
          onCopy={status.resetLink ? () => copyResetLink(status.resetLink) : undefined}
          onDismiss={clearStatus}
        />
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
              <td className="py-2">
                {formatUserRoleLabel(u.role)}
                {isFounderUser(users, u.id) && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">(owner)</span>
                )}
              </td>
              <td className="py-2">{u.displayName}</td>
              <td className="py-2">
                <div className="flex flex-wrap gap-2">
                  {!isFounderUser(users, u.id) &&
                    ["member", "finance", "admin"]
                      .filter((nextRole) => nextRole !== u.role)
                      .map((nextRole) => (
                        <Button
                          key={nextRole}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={roleUpdating === u.id || removing === u.id}
                          onClick={() => handleRoleChange(u.id, nextRole)}
                        >
                          Make {nextRole}
                        </Button>
                      ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      roleUpdating === u.id ||
                      removing === u.id ||
                      u.id === user?.uid ||
                      u.id === founderId
                    }
                    onClick={() => handleRemove(u)}
                    className="text-red-700 hover:text-red-800"
                  >
                    {removing === u.id ? "Removing…" : "Remove"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs text-muted-foreground">
        The first account on a new site becomes admin automatically. After that, invite users here.
        Members can sign in but cannot access the builder. Finance users can view donations and
        configure giving pages. Admins have full builder access. Remove deletes their profile and
        Firebase sign-in. The original site owner cannot be removed or demoted.
      </p>
    </div>
  );
}

/**
 * @param {{ status: StatusNotice, copied: boolean, onCopy?: () => void, onDismiss: () => void }} props
 */
function StatusNotice({ status, copied, onCopy, onDismiss }) {
  const isError = status.type === "error";

  return (
    <Card
      className={
        isError
          ? "border-red-200 bg-red-50/80"
          : "border-green-200 bg-green-50/80"
      }
    >
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p
              className={`text-sm font-medium ${isError ? "text-red-900" : "text-green-900"}`}
            >
              {status.title}
            </p>
            {status.description && (
              <p className={`text-sm ${isError ? "text-red-800" : "text-green-800"}`}>
                {status.description}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss} className="shrink-0">
            Dismiss
          </Button>
        </div>

        {status.resetLink && onCopy && (
          <div className="space-y-2 rounded-md border border-green-200/80 bg-white/70 p-3">
            <Label htmlFor="invite-reset-link" className="text-xs text-green-900">
              Password setup link
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="invite-reset-link"
                readOnly
                value={status.resetLink}
                className="font-mono text-xs text-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-green-300 bg-white"
                onClick={onCopy}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy link
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-green-800/80">
              This link expires after use. Send it through a secure channel.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Check, Copy, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  filterStaffUsers,
  formatUserRoleLabel,
  isAdminRole,
  isFinanceRole,
  normalizeUserRole,
  STAFF_USER_ROLES,
} from "@/lib/auth/roles";
import { getFounderUserId } from "@/lib/site/founder";

/** @typedef {{ type: "success" | "error", title: string, description?: string, resetLink?: string }} StatusNotice */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @type {Record<string, string>} */
const ROLE_DESCRIPTIONS = {
  member: "Can sign in, but cannot open the builder.",
  finance: "Can view donations and configure giving pages.",
  admin: "Full builder access, including users and settings.",
};

/** @param {unknown} role @returns {"default" | "secondary" | "outline"} */
function getRoleBadgeVariant(role) {
  if (isAdminRole(role)) return "default";
  if (isFinanceRole(role)) return "secondary";
  return "outline";
}

export function UsersAdmin({ users }) {
  const { user } = useAuth();
  const founderId = useMemo(() => getFounderUserId(users), [users]);
  const staffUsers = useMemo(() => filterStaffUsers(users), [users]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [emailError, setEmailError] = useState(null);
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

    const email = inviteEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError(email ? "Enter a valid email address." : "Enter an email address.");
      return;
    }

    setEmailError(null);
    setSubmitting(true);
    clearStatus();

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
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
        description: `User is now a ${formatUserRoleLabel(role).toLowerCase()}.`,
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
    <div className="mx-auto max-w-4xl space-y-6">
      <form onSubmit={handleInvite} noValidate>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Invite a user</CardTitle>
            <CardDescription>
              They receive an email to set a password, then sign in with the role you choose.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                autoComplete="off"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="user@church.org"
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "invite-email-error" : undefined}
              />
              {emailError && (
                <p id="invite-email-error" className="text-xs text-destructive">
                  {emailError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="invite-name"
                type="text"
                autoComplete="off"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_USER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {formatUserRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[inviteRole]}</p>
            <Button type="submit" disabled={submitting}>
              <UserPlus className="size-3.5" />
              {submitting ? "Sending…" : "Send invitation"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {status && (
        <StatusNotice
          status={status}
          copied={copied}
          onCopy={status.resetLink ? () => copyResetLink(status.resetLink) : undefined}
          onDismiss={clearStatus}
        />
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Site accounts</CardTitle>
          <CardDescription>
            {staffUsers.length === 1 ? "1 account" : `${staffUsers.length} accounts`} with member,
            finance, or admin access. Donor accounts created by online giving are managed on the
            Donations tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    User
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((u) => {
                  const isFounder = u.id === founderId;
                  const isSelf = u.id === user?.uid;
                  const busy = roleUpdating === u.id || removing === u.id;
                  const removeBlockedReason = isFounder
                    ? "The original site owner cannot be removed."
                    : isSelf
                      ? "You cannot remove your own account."
                      : null;

                  return (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-foreground">
                            {u.displayName || u.email || "Unknown user"}
                          </span>
                          {isFounder && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Owner
                            </Badge>
                          )}
                          {isSelf && (
                            <Badge variant="outline" className="text-muted-foreground">
                              You
                            </Badge>
                          )}
                        </div>
                        {u.displayName && u.email && (
                          <p className="mt-0.5 text-xs break-all text-muted-foreground">{u.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={getRoleBadgeVariant(u.role)}>
                          {formatUserRoleLabel(u.role)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {isFounder ? (
                            <span className="text-xs text-muted-foreground">
                              Role cannot be changed
                            </span>
                          ) : (
                            <Select
                              value={normalizeUserRole(u.role)}
                              disabled={busy}
                              onValueChange={(role) => handleRoleChange(u.id, role)}
                            >
                              <SelectTrigger
                                size="sm"
                                className="w-32"
                                aria-label={`Role for ${u.email || u.displayName || "user"}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STAFF_USER_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {formatUserRoleLabel(role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={busy || removeBlockedReason !== null}
                            title={removeBlockedReason ?? undefined}
                            onClick={() => handleRemove(u)}
                          >
                            <Trash2 className="size-3.5" />
                            {removing === u.id ? "Removing…" : "Remove"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {staffUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No member, finance, or admin accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="space-y-3">
          <dl className="grid gap-3 sm:grid-cols-3">
            {STAFF_USER_ROLES.map((role) => (
              <div key={role} className="space-y-0.5">
                <dt className="text-xs font-medium text-foreground">
                  {formatUserRoleLabel(role)}
                </dt>
                <dd className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            The first account on a new site becomes admin automatically. Remove deletes the profile
            and the Firebase sign-in. The original site owner cannot be removed or demoted.
          </p>
        </CardContent>
      </Card>
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
      <CardContent className="space-y-3">
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

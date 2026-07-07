"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { SecuritySection } from "@/components/account/SecuritySection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { canAccessDonorPortal } from "@/lib/auth/roles";
import { DEFAULT_PRESET_AMOUNTS_CENTS } from "@/lib/donations/schema";
import { COLLECTIONS } from "@/lib/firestore/paths";

function formatCurrency(cents, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatFrequency(frequency) {
  if (frequency === "weekly") return "Weekly";
  if (frequency === "monthly") return "Monthly";
  return "One-time";
}

/**
 * @param {object} props
 * @param {import("@/types/firestore").SubscriptionRecord & { id: string }} props.subscription
 * @param {() => Promise<string | null>} props.getIdToken
 * @param {() => void} props.onUpdated
 */
function SubscriptionCard({ subscription, getIdToken, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(subscription.amountCents / 100));
  const [frequency, setFrequency] = useState(subscription.frequency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const isActive =
    subscription.status === "active" || subscription.status === "trialing";
  const isCancelScheduled = subscription.cancelAtPeriodEnd;

  async function handleCancel() {
    if (
      !window.confirm(
        isCancelScheduled
          ? "This gift is already scheduled to end. Continue?"
          : "Cancel this recurring gift at the end of the current billing period?",
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/donor/subscriptions/${subscription.id}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ immediate: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancel failed");
      setMessage("Your recurring gift will end after the current billing period.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents < 100) {
      setError("Minimum amount is $1.00.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/donor/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amountCents: cents, frequency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMessage("Your recurring gift was updated.");
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateCard() {
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/donor/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open billing portal.");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-zinc-900">
            {formatCurrency(subscription.amountCents, subscription.currency)}
            <span className="ml-2 text-sm font-normal text-zinc-600">
              {formatFrequency(subscription.frequency)}
            </span>
          </p>
          <p className="text-sm text-zinc-600">{subscription.fundLabel || "General Fund"}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Status: {subscription.status}
            {isCancelScheduled ? " (cancels at period end)" : ""}
          </p>
          {subscription.currentPeriodEnd && (
            <p className="text-xs text-zinc-500">
              Next charge: {formatDate(subscription.currentPeriodEnd)}
            </p>
          )}
        </div>

        {isActive && !editing && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleUpdateCard} disabled={loading}>
              Update card
            </Button>
            {!isCancelScheduled && (
              <Button type="button" variant="destructive" size="sm" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <form onSubmit={handleUpdate} className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`amount-${subscription.id}`}>Amount (USD)</Label>
              <Input
                id={`amount-${subscription.id}`}
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`frequency-${subscription.id}`}>Frequency</Label>
              <select
                id={`frequency-${subscription.id}`}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              Save changes
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
    </div>
  );
}

export function MyGivingPage() {
  const router = useRouter();
  const { user, userRole, loading: authLoading, logOut } = useAuth();
  const [donations, setDonations] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const getIdToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !canAccessDonorPortal(userRole)) {
      router.replace("/give/account/login");
      return;
    }

    let cancelled = false;

    async function loadData() {
      const { getFirebaseFirestore } = await import("@/lib/firebase/firestore");
      const db = getFirebaseFirestore();

      const donationsQuery = query(
        collection(db, COLLECTIONS.donations),
        where("donorUid", "==", user.uid),
        orderBy("createdAt", "desc"),
      );

      const subscriptionsQuery = query(
        collection(db, COLLECTIONS.subscriptions),
        where("donorUid", "==", user.uid),
        orderBy("updatedAt", "desc"),
      );

      const unsubDonations = onSnapshot(
        donationsQuery,
        (snap) => {
          if (cancelled) return;
          setDonations(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          setDataLoading(false);
        },
        () => {
          if (!cancelled) setDataLoading(false);
        },
      );

      const unsubSubscriptions = onSnapshot(subscriptionsQuery, (snap) => {
        if (cancelled) return;
        setSubscriptions(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      return () => {
        unsubDonations();
        unsubSubscriptions();
      };
    }

    let cleanup;
    loadData().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [authLoading, user, userRole, router]);

  const activeSubscriptions = useMemo(
    () =>
      subscriptions.filter(
        (sub) => sub.status === "active" || sub.status === "trialing" || sub.cancelAtPeriodEnd,
      ),
    [subscriptions],
  );

  if (authLoading || !user || !canAccessDonorPortal(userRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-600">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">My Giving</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Signed in as {user.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/give">Give again</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void logOut().then(() => router.push("/give"));
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-900">Recurring gifts</h2>
          {dataLoading ? (
            <p className="text-sm text-zinc-600">Loading…</p>
          ) : activeSubscriptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
              No active recurring gifts.{" "}
              <Link href="/give" className="font-medium text-zinc-900 hover:underline">
                Make a recurring donation
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {activeSubscriptions.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  getIdToken={getIdToken}
                  onUpdated={() => {}}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-500">
            Suggested amounts when editing:{" "}
            {DEFAULT_PRESET_AMOUNTS_CENTS.map((cents) => formatCurrency(cents)).join(", ")}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-900">Donation history</h2>
          {donations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600">
              No donations linked to this account yet. Past gifts made with {user.email} are added
              when you sign up or sign in.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Fund</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((donation) => (
                    <tr key={donation.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3 text-zinc-700">{formatDate(donation.createdAt)}</td>
                      <td className="px-4 py-3 text-zinc-900">
                        {formatCurrency(donation.amountCents, donation.currency)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{donation.fundLabel || "—"}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatFrequency(donation.frequency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-900">Account security</h2>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <SecuritySection />
          </div>
        </section>
      </div>
    </div>
  );
}

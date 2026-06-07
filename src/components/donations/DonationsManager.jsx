"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import {
  formatDonationAmount,
  formatDonationDate,
  formatDonationFrequency,
  formatDonorAddress,
} from "@/lib/donations/schema";

/**
 * @param {import('@/types/firestore').DonationRecord & { id: string }} donation
 */
function getDonorName(donation) {
  return donation.donor?.name || "—";
}

/**
 * @param {import('@/types/firestore').DonationRecord & { id: string }} donation
 */
function getDonorEmail(donation) {
  return donation.donor?.email || donation.donorEmail || "—";
}

/**
 * @param {import('@/types/firestore').DonationRecord & { id: string }} donation
 */
function getDonorPhone(donation) {
  return donation.donor?.phone || "—";
}

export function DonationsManager() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const q = query(collection(db, COLLECTIONS.donations), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setDonations(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to load donations.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return (
    <Card className="mx-auto max-w-7xl">
      <CardHeader>
        <CardTitle>Donations</CardTitle>
        <CardDescription>
          Completed online gifts with donor contact information. New donations appear after Stripe
          checkout completes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading donations…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && donations.length === 0 && (
          <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
        )}

        {!loading && !error && donations.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Phone</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Address</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Frequency</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Fund</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((donation) => (
                  <tr key={donation.id} className="border-b border-border last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 align-top text-foreground">
                      {formatDonationDate(donation.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-top font-medium text-foreground">
                      {getDonorName(donation)}
                    </td>
                    <td className="px-4 py-3 align-top text-foreground">
                      {getDonorEmail(donation) !== "—" ? (
                        <a
                          href={`mailto:${getDonorEmail(donation)}`}
                          className="text-primary hover:underline"
                        >
                          {getDonorEmail(donation)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-foreground">
                      {getDonorPhone(donation)}
                    </td>
                    <td className="max-w-xs px-4 py-3 align-top text-foreground">
                      {formatDonorAddress(donation.donor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top font-medium text-foreground">
                      {formatDonationAmount(donation.amountCents, donation.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-foreground">
                      {formatDonationFrequency(donation.frequency)}
                    </td>
                    <td className="px-4 py-3 align-top text-foreground">
                      {donation.fundLabel || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

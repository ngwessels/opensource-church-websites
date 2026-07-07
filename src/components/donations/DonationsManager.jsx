"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Download, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DonationsFilters } from "@/components/donations/DonationsFilters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadDonationsCsv, downloadDonationsPdf } from "@/lib/donations/export";
import {
  emptyDonationFilters,
  filterDonations,
  getDonorEmail,
  getDonorName,
  getDonorPhone,
} from "@/lib/donations/filter";
import {
  formatDonationAmount,
  formatDonationDate,
  formatDonationFrequency,
  formatDonorAddress,
} from "@/lib/donations/schema";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";

/**
 * @param {object} [props]
 * @param {string} [props.siteName]
 */
export function DonationsManager({ siteName = "Donations Report" }) {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(emptyDonationFilters);
  const [exportingPdf, setExportingPdf] = useState(false);

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

  const filteredDonations = useMemo(
    () => filterDonations(donations, filters),
    [donations, filters],
  );

  const currency = filteredDonations[0]?.currency || donations[0]?.currency || "usd";
  const canExport = !loading && !error && filteredDonations.length > 0;

  async function handleExportPdf() {
    if (!canExport) return;
    setExportingPdf(true);
    try {
      await downloadDonationsPdf({
        donations: filteredDonations,
        filters,
        siteName,
        currency,
      });
    } finally {
      setExportingPdf(false);
    }
  }

  function handleExportCsv() {
    if (!canExport) return;
    downloadDonationsCsv({
      donations: filteredDonations,
      filters,
      siteName,
      currency,
    });
  }

  return (
    <Card className="mx-auto max-w-7xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Donations</CardTitle>
            <CardDescription>
              Completed online gifts with donor contact information. One-time gifts appear after
              checkout; recurring gifts also appear after each successful renewal charge.
            </CardDescription>
          </div>
          {donations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canExport}
                onClick={handleExportCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canExport || exportingPdf}
                onClick={handleExportPdf}
              >
                <FileText className="mr-2 h-4 w-4" />
                {exportingPdf ? "Exporting…" : "Export PDF"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading donations…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && donations.length === 0 && (
          <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
        )}

        {!loading && !error && donations.length > 0 && (
          <>
            <DonationsFilters
              filters={filters}
              onChange={setFilters}
              donations={donations}
              filteredDonations={filteredDonations}
            />

            {filteredDonations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No donations match your filters.</p>
            ) : (
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
                      <th className="px-4 py-3 font-medium text-muted-foreground">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDonations.map((donation) => (
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
                        <td className="max-w-xs px-4 py-3 align-top text-foreground">
                          {donation.donorComment ? (
                            <span title={donation.donorComment} className="line-clamp-2">
                              {donation.donorComment}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

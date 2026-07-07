import {
  describeDonationFilters,
  getDonorEmail,
  getDonorName,
  getDonorPhone,
  sumDonationAmountCents,
} from "./filter.js";
import {
  formatDonationAmount,
  formatDonationDate,
  formatDonationFrequency,
  formatDonorAddress,
} from "./schema.js";

/** @typedef {import("./filter.js").DonationRow} DonationRow */
/** @typedef {import("./filter.js").DonationFilters} DonationFilters */

const CSV_COLUMNS = [
  "Date",
  "Name",
  "Email",
  "Phone",
  "Address",
  "Amount",
  "Frequency",
  "Fund",
  "Comment",
];

/**
 * @param {unknown} value
 */
function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * @param {DonationRow} donation
 */
function donationToRow(donation) {
  return [
    formatDonationDate(donation.createdAt),
    getDonorName(donation),
    getDonorEmail(donation),
    getDonorPhone(donation),
    formatDonorAddress(donation.donor),
    formatDonationAmount(donation.amountCents, donation.currency),
    formatDonationFrequency(donation.frequency),
    donation.fundLabel || "—",
    donation.donorComment || "",
  ];
}

/**
 * @returns {string}
 */
function reportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {string} siteName
 */
function formatGeneratedAt() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * @param {object} options
 * @param {DonationRow[]} options.donations
 * @param {DonationFilters} options.filters
 * @param {string} [options.siteName]
 * @param {string} [options.currency="usd"]
 */
export function buildDonationsCsv({ donations, filters, siteName = "Donations Report", currency = "usd" }) {
  const totalCents = sumDonationAmountCents(donations);
  const metadata = [
    [siteName],
    [`Generated: ${formatGeneratedAt()}`],
    [`Filters: ${describeDonationFilters(filters)}`],
    [`Rows: ${donations.length}`],
    [`Total: ${formatDonationAmount(totalCents, currency)}`],
    [],
  ];

  const rows = donations.map(donationToRow);
  const lines = [...metadata, CSV_COLUMNS, ...rows].map((row) =>
    row.map((cell) => escapeCsvCell(cell)).join(","),
  );

  return `\uFEFF${lines.join("\n")}`;
}

/**
 * @param {string} filename
 * @param {Blob} blob
 */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {object} options
 * @param {DonationRow[]} options.donations
 * @param {DonationFilters} options.filters
 * @param {string} [options.siteName]
 * @param {string} [options.currency="usd"]
 */
export function downloadDonationsCsv(options) {
  const csv = buildDonationsCsv(options);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(`donations-${reportDateStamp()}.csv`, blob);
}

/**
 * @param {object} options
 * @param {DonationRow[]} options.donations
 * @param {DonationFilters} options.filters
 * @param {string} [options.siteName]
 * @param {string} [options.currency="usd"]
 */
export async function downloadDonationsPdf({
  donations,
  filters,
  siteName = "Donations Report",
  currency = "usd",
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const totalCents = sumDonationAmountCents(donations);
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.text(siteName, margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Generated: ${formatGeneratedAt()}`, margin, y);
  y += 14;
  doc.text(`Filters: ${describeDonationFilters(filters)}`, margin, y);
  y += 14;
  doc.text(
    `Rows: ${donations.length} · Total: ${formatDonationAmount(totalCents, currency)}`,
    margin,
    y,
  );
  y += 20;

  doc.setTextColor(0);

  autoTable(doc, {
    startY: y,
    head: [CSV_COLUMNS],
    body: donations.map(donationToRow),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [55, 65, 81] },
    margin: { left: margin, right: margin },
  });

  doc.save(`donations-${reportDateStamp()}.pdf`);
}

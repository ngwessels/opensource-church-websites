import { downloadBlob } from "@/lib/donations/export";

/**
 * @param {{ name?: string, downloadUrl?: string }} file
 */
export async function downloadMediaFile(file) {
  const url = file.downloadUrl?.trim();
  if (!url) {
    throw new Error("This file does not have a download URL.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to download file.");
  }

  const blob = await response.blob();
  downloadBlob(file.name || "download", blob);
}

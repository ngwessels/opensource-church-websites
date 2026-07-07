import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import {
  buildSiteExportZip,
  getSiteExportFilename,
  getSiteExportPreview,
} from "@/lib/export/site-export";
import { getFirebaseAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";

export const runtime = "nodejs";
export const maxDuration = 300;

async function getSiteName() {
  const db = getFirebaseAdminFirestore();
  if (!db) return "";
  const snap = await db.collection(COLLECTIONS.site).doc(SITE_CONFIG_ID).get();
  return snap.exists && typeof snap.data()?.name === "string" ? snap.data().name : "";
}

export async function GET(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getAdminUserFromRequest(request);

    const { searchParams } = new URL(request.url);
    const siteName = await getSiteName();

    if (searchParams.get("download") === "1") {
      const stream = await buildSiteExportZip({ siteName });
      const webStream = Readable.toWeb(stream);

      return new Response(webStream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${getSiteExportFilename()}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const preview = await getSiteExportPreview({ siteName });
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    const status = message.includes("authorization") || message.includes("Admin access") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

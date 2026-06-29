import { NextResponse } from "next/server";

import { getAdminUserFromRequest } from "@/lib/cms/auth";
import { createBulletinAdmin, deleteBulletinAdmin } from "@/lib/cms/bulletins";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listBulletinsServer } from "@/lib/firestore/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const bulletins = await listBulletinsServer();
    return NextResponse.json({ bulletins });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load bulletins.";
    return NextResponse.json({ error: message, bulletins: [] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getAdminUserFromRequest(request);

    const body = await request.json();
    const bulletin = await createBulletinAdmin({
      date: body?.date,
      title: body?.title,
      mediaId: body?.mediaId,
      downloadUrl: body?.downloadUrl,
    });

    return NextResponse.json({ bulletin });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create bulletin.";
    const status =
      message === "Missing authorization" || message === "Admin access required" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    await getAdminUserFromRequest(request);

    const bulletinId = new URL(request.url).searchParams.get("id")?.trim();
    const result = await deleteBulletinAdmin(bulletinId);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete bulletin.";
    const status =
      message === "Missing authorization" || message === "Admin access required"
        ? 401
        : message === "Bulletin not found."
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

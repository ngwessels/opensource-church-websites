import { NextResponse } from "next/server";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

function isPdfMedia({ mimeType, name }) {
  if (mimeType === "application/pdf") return true;
  if (typeof name === "string" && name.toLowerCase().endsWith(".pdf")) return true;
  return false;
}

export async function GET(request) {
  const mediaId = new URL(request.url).searchParams.get("mediaId")?.trim();
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required." }, { status: 400 });
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 500 });
  }

  const snap = await db.collection(COLLECTIONS.media).doc(mediaId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const data = snap.data();
  const { downloadUrl, mimeType, name } = data || {};

  if (!downloadUrl) {
    return NextResponse.json({ error: "Media has no file." }, { status: 404 });
  }

  if (!isPdfMedia({ mimeType, name })) {
    return NextResponse.json({ error: "Media is not a PDF." }, { status: 400 });
  }

  try {
    const pdfRes = await fetch(downloadUrl);
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "Failed to fetch PDF." }, { status: 502 });
    }

    const buffer = await pdfRes.arrayBuffer();
    const filename =
      typeof name === "string" && name.trim() ? name.trim() : `document-${mediaId}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch PDF." }, { status: 502 });
  }
}

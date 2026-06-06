import { NextResponse } from "next/server";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

export async function GET(request) {
  const date = new URL(request.url).searchParams.get("date")?.trim();
  if (!date) {
    return NextResponse.json({ error: "date is required." }, { status: 400 });
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 500 });
  }

  const snap = await db
    .collection(COLLECTIONS.bulletins)
    .where("date", "==", date)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "Bulletin not found." }, { status: 404 });
  }

  const { downloadUrl } = snap.docs[0].data();
  if (!downloadUrl) {
    return NextResponse.json({ error: "Bulletin has no PDF." }, { status: 404 });
  }

  try {
    const pdfRes = await fetch(downloadUrl);
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "Failed to fetch PDF." }, { status: 502 });
    }

    const buffer = await pdfRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="bulletin-${date}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch PDF." }, { status: 502 });
  }
}

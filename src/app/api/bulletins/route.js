import { NextResponse } from "next/server";

import { listBulletinsServer } from "@/lib/firestore/server";

export async function GET() {
  try {
    const bulletins = await listBulletinsServer();
    return NextResponse.json({ bulletins });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load bulletins.";
    return NextResponse.json({ error: message, bulletins: [] }, { status: 500 });
  }
}

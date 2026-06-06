import { NextResponse } from "next/server";

import { fetchDailyReadings } from "@/lib/readings/evangelizo";
import { toIsoDate } from "@/lib/readings/schema";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date")?.trim();
  const date = dateParam ? toIsoDate(dateParam) : toIsoDate(new Date());

  try {
    const readings = await fetchDailyReadings(date);
    return NextResponse.json({ readings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch readings.";
    return NextResponse.json({ error: message, readings: null }, { status: 502 });
  }
}

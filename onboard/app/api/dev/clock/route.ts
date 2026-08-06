import { NextResponse } from "next/server";
import { TEST_MODE, advanceClock, resetClock, now } from "@/lib/clock";

// Dev/test-only control of the injectable clock.

export async function POST(req: Request) {
  if (!TEST_MODE) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const { advanceMs, reset } = await req.json();
  if (reset) resetClock();
  if (typeof advanceMs === "number") advanceClock(advanceMs);
  return NextResponse.json({ now: now().toISOString() });
}

export async function GET() {
  if (!TEST_MODE) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json({ now: now().toISOString() });
}

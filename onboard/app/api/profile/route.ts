import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

const MAX_LENGTH = 80;

// A member sets their own display name. The role is re-checked here — the page
// gate is not the authorization boundary — and the row updated is always the
// session's own user, so a member can never rename anyone else.
export async function POST(req: Request) {
  const user = await currentUser();
  if (user?.role !== "MEMBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { displayName } = await req.json();
  if (displayName !== null && typeof displayName !== "string") {
    return NextResponse.json(
      { error: "Display name must be a string" },
      { status: 400 }
    );
  }

  const trimmed = typeof displayName === "string" ? displayName.trim() : "";
  if (trimmed.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Display name must be at most ${MAX_LENGTH} characters` },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { displayName: trimmed === "" ? null : trimmed },
    select: { displayName: true },
  });

  return NextResponse.json({ displayName: updated.displayName });
}

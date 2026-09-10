import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

const MAX_LENGTH = 60;

// A member sets their own display name. The role is re-checked here: the
// page gate on /onboarding is not the authorization boundary.
export async function POST(req: Request) {
  const user = await currentUser();
  if (user?.role !== "MEMBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { displayName } = await req.json();
  if (typeof displayName !== "string") {
    return NextResponse.json(
      { error: "Display name is required" },
      { status: 400 }
    );
  }
  const trimmed = displayName.trim();
  if (trimmed.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Display name must be at most ${MAX_LENGTH} characters` },
      { status: 400 }
    );
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { displayName: trimmed === "" ? null : trimmed },
  });
  return NextResponse.json({ displayName: updated.displayName });
}

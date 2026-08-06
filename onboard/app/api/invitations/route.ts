import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { invitationToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";

const EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const user = await currentUser();
  if (user?.role !== "LEADER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const team = await prisma.team.findUnique({ where: { leaderId: user.id } });
  if (!team) {
    return NextResponse.json({ error: "No team" }, { status: 400 });
  }
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }
  // Re-inviting the same email replaces any pending invitation.
  await prisma.invitation.deleteMany({
    where: { email, teamId: team.id, usedAt: null },
  });
  const createdAt = now();
  const invitation = await prisma.invitation.create({
    data: {
      email,
      token: await invitationToken(),
      teamId: team.id,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + EXPIRY_MS),
    },
  });
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/invite/${invitation.token}`;
  await sendEmail(
    email,
    "You have been invited to onboard",
    `Hi! ${user.email} invited you to join ${team.name}. Follow this link to create your account: ${link} (valid for 24 hours)`
  );
  return NextResponse.json({ ok: true });
}

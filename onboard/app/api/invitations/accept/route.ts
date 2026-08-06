import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { now } from "@/lib/clock";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.usedAt || invitation.expiresAt < now()) {
    return NextResponse.json({ error: "Invitation is invalid or has expired" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) {
    return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  }
  const member = await prisma.user.create({
    data: {
      email: invitation.email,
      passwordHash: hashPassword(password),
      role: "MEMBER",
      teamId: invitation.teamId,
      progress: { create: {} },
    },
  });
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { usedAt: now() },
  });
  await createSession(member.id);
  return NextResponse.json({ redirect: "/onboarding" });
}

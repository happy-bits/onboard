import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  const user = await currentUser();
  if (user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }
  const leader = await prisma.user.create({
    data: { email, passwordHash: hashPassword(password), role: "LEADER" },
  });
  await prisma.team.create({
    data: { name: `Team ${email}`, leaderId: leader.id },
  });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const leader = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!leader || leader.role !== "LEADER") {
    return NextResponse.json({ error: "Leader not found" }, { status: 404 });
  }
  // Deleting the leader cascades to their team, which cascades to its
  // members, invitations, progress and sessions.
  await prisma.user.delete({ where: { id: leader.id } });
  return NextResponse.json({ ok: true });
}

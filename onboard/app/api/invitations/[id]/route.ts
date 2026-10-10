import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (user?.role !== "LEADER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const team = await prisma.team.findUnique({ where: { leaderId: user.id } });
  if (!team) {
    return NextResponse.json({ error: "No team" }, { status: 400 });
  }
  const { id } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { id: Number(id) },
  });
  if (!invitation || invitation.teamId !== team.id) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.usedAt) {
    return NextResponse.json(
      { error: "Invitation has already been accepted" },
      { status: 409 }
    );
  }
  // Like re-inviting, cancelling deletes the pending row so the link stops working.
  await prisma.invitation.delete({ where: { id: invitation.id } });
  return NextResponse.json({ ok: true });
}

import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { now } from "@/lib/clock";

export const dynamic = "force-dynamic";

// CSV export of the leader's own team: one row per Member, plus a header row.

const HEADER = ["email", "step1", "step2", "step3", "completed"];

// Minimal RFC 4180 quoting: only quote when the value needs it.
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

export async function GET() {
  const user = await currentUser();
  if (user?.role !== "LEADER") {
    return new Response("Forbidden", { status: 403 });
  }
  // Scoped by leaderId, so a leader can only ever export their own team.
  const team = await prisma.team.findUnique({ where: { leaderId: user.id } });
  if (!team) {
    return new Response("No team", { status: 400 });
  }

  const members = await prisma.user.findMany({
    where: { teamId: team.id, role: "MEMBER" },
    orderBy: { id: "asc" },
    select: { email: true, progress: true },
  });

  const rows = members.map((member) => {
    const steps = [
      member.progress?.step1 ?? false,
      member.progress?.step2 ?? false,
      member.progress?.step3 ?? false,
    ];
    return csvRow([
      member.email,
      ...steps.map((done) => (done ? "yes" : "no")),
      `${steps.filter(Boolean).length}/${steps.length}`,
    ]);
  });

  const csv = [csvRow(HEADER), ...rows].join("\n") + "\n";
  const date = now().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="team-progress-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// CSV export of the requesting leader's own team progress. The team is looked
// up from the session user, never from the request, so a leader can only ever
// download their own members.

const HEADER = ["email", "step1", "step2", "step3", "completed"];

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "team"
  );
}

export async function GET() {
  const user = await currentUser();
  if (user?.role !== "LEADER") {
    return new Response("Forbidden", { status: 403 });
  }
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
      `${steps.filter(Boolean).length}/3`,
    ]);
  });

  // Trailing newline so the file ends on a complete record.
  const csv = [csvRow(HEADER), ...rows].join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug(team.name)}-progress.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

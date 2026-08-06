import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import LeaderDashboard from "./LeaderDashboard";

export const dynamic = "force-dynamic";

export default async function LeaderPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "LEADER") redirect("/");

  const team = await prisma.team.findUnique({
    where: { leaderId: user.id },
    include: {
      members: {
        where: { role: "MEMBER" },
        orderBy: { id: "asc" },
        select: { id: true, email: true, progress: true },
      },
      invitations: { orderBy: { id: "asc" } },
    },
  });
  if (!team) redirect("/");

  return (
    <main className="mx-auto mt-12 max-w-2xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{team.name}</h1>
        <LogoutButton />
      </div>
      <LeaderDashboard
        initialMembers={team.members.map((m) => ({
          id: m.id,
          email: m.email,
          progress: m.progress && {
            step1: m.progress.step1,
            step2: m.progress.step2,
            step3: m.progress.step3,
          },
        }))}
        invitations={team.invitations.map((i) => ({
          id: i.id,
          email: i.email,
          used: i.usedAt !== null,
        }))}
      />
    </main>
  );
}

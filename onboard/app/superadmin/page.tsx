import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import LeaderAdmin from "./LeaderAdmin";

export const dynamic = "force-dynamic";

export default async function SuperadminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/");

  const leaders = await prisma.user.findMany({
    where: { role: "LEADER" },
    orderBy: { id: "asc" },
    select: { id: true, email: true },
  });

  return (
    <main className="mx-auto mt-12 max-w-2xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Superadmin</h1>
        <LogoutButton />
      </div>
      <LeaderAdmin leaders={leaders} />
    </main>
  );
}
